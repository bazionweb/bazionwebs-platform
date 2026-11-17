import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from '../shims/react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import type { Application, RecommendationRequest, StatusLogEntry, AdmissionsDecision } from '../lib/api';
import { validateDocument } from '../lib/documentValidation';

const STATUS_STEPS: Record<string, { label: string; icon: string; pct: number }> = {
  draft: { label: 'Draft', icon: '📝', pct: 10 },
  submitted: { label: 'Submitted', icon: '📬', pct: 30 },
  under_review: { label: 'Under Review', icon: '🔍', pct: 60 },
  accepted: { label: 'Offer Extended', icon: '🎉', pct: 85 },
  rejected: { label: 'Decision Made', icon: '📋', pct: 100 },
  waitlisted: { label: 'Waitlisted', icon: '⏳', pct: 80 },
};

const DOC_TYPES = ['transcript', 'id_document', 'other'];

export default function Status() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [app, setApp] = useState<Application | null>(null);
  const [decision, setDecision] = useState<AdmissionsDecision | null>(null);
  const [recs, setRecs] = useState<RecommendationRequest[]>([]);
  const [logs, setLogs] = useState<StatusLogEntry[]>([]);
  const [canonicalStatus, setCanonicalStatus] = useState<string>('PROSPECT');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Provisioning progress state
  const [provisioningData, setProvisioningData] = useState<{
    status: string;
    uid: string | null;
    regNo: string | null;
    studentEmail: string | null;
    iamProvisioned?: boolean;
    iamPendingReason?: string | null;
    steps: Array<{ step: string; label: string; status: string; completedAt?: string; error?: string }>;
  } | null>(null);
  const [acceptingOffer, setAcceptingOffer] = useState(false);
  const [depositBusy, setDepositBusy] = useState(false);

  // Document upload state
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [docType, setDocType] = useState('transcript');
  const fileRef = useRef<HTMLInputElement>(null);

  // Referee state
  const [recName, setRecName] = useState('');
  const [recEmail, setRecEmail] = useState('');
  const [recLoading, setRecLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [appData, statusRes] = await Promise.all([
        api.applications.getMyApplication().catch(() => null),
        api.enrollment.getStatus().catch(() => ({ status: 'PROSPECT', lastChangedAt: '', reason: null })),
      ]);

      setApp(appData);
      setCanonicalStatus(statusRes.status);

      if (appData) {
        const [recData, logData, decisionData] = await Promise.all([
          api.recommendations.list(appData.id).catch(() => [] as RecommendationRequest[]),
          api.applications.getStatusLogs(appData.id).catch(() => [] as StatusLogEntry[]),
          api.admissions.getDecision(appData.id).catch(() => null),
        ]);
        setRecs(recData);
        setLogs(logData);
        setDecision(decisionData);

        // If offer is accepted or provisioned, query live provisioning status
        if (
          appData.status === 'accepted' ||
          ['OFFER_ACCEPTED', 'PROVISIONING_IN_PROGRESS', 'PROVISIONED', 'REGISTRATION_ELIGIBLE', 'REGISTERED', 'OFFICIALLY_ENROLLED'].includes(statusRes.status)
        ) {
          const prov = await api.provisioning.getStatus().catch(() => null);
          if (prov) setProvisioningData(prov);
        }
      }
    } catch {
      setApp(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 15000);
    return () => clearInterval(id);
  }, [loadData]);

  const handleAcceptOffer = async () => {
    if (!app) return;
    setAcceptingOffer(true);
    setError('');
    setActionSuccess('');
    try {
      const res = await api.admissions.acceptOffer(app.id);
      if (res.success) {
        setActionSuccess('🎉 Congratulations! You have accepted your admission offer. Your permanent institutional accounts are being provisioned.');
        // Acceptance flips the server-side role applicant → student. Re-pull
        // the session so route guards and student-only APIs work immediately
        // without forcing a logout/login cycle.
        try {
          await refresh();
        } catch {
          // Non-fatal: the API authorizes against the live DB role anyway.
        }
        loadData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept offer.');
    } finally {
      setAcceptingOffer(false);
    }
  };

  const handleDeclineOffer = async () => {
    if (!app || !confirm('Are you sure you want to decline this admission offer? This action cannot be undone.')) return;
    try {
      await api.admissions.declineOffer(app.id);
      setActionSuccess('Offer declined.');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to decline offer.');
    }
  };

  const handlePayDeposit = async () => {
    if (!app) return;
    setDepositBusy(true);
    setError('');
    try {
      // Gateway flow: create a deposit intent (server-priced), redirect to the
      // gateway, and confirm on return via ?reference= (see effect below).
      const intent = await api.admissions.createDepositIntent(app.id);
      if (intent.authorizationUrl) {
        window.location.href = intent.authorizationUrl;
        return;
      }
      // No redirect (e.g. test gateway): confirm directly.
      if (intent.reference) {
        await api.admissions.payDeposit(app.id, intent.reference);
        setActionSuccess('Deposit confirmed. You may now accept your offer.');
        loadData();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start deposit payment.');
    } finally {
      setDepositBusy(false);
    }
  };

  // Gateway return: ?reference= / ?trxref= → confirm the deposit server-side
  // (the server re-verifies via the gateway; the reference alone confers nothing).
  useEffect(() => {
    const ref = params.get('reference') || params.get('trxref');
    if (!ref || !app) return;
    (async () => {
      setDepositBusy(true);
      try {
        await api.admissions.payDeposit(app.id, ref);
        setActionSuccess('Deposit confirmed. You may now accept your offer.');
        loadData();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Deposit confirmation failed.');
      } finally {
        setDepositBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app?.id]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !app) return;

    const validation = await validateDocument(file, docType);
    if (!validation.valid) {
      setUploadStatus(s => ({ ...s, [docType]: validation.errors.join(' ') }));
      return;
    }

    setUploadStatus(s => ({ ...s, [docType]: 'uploading' }));
    try {
      const result: any = await api.documents.upload(app.id, docType, file);
      if (result.success) {
        setUploadStatus(s => ({ ...s, [docType]: 'done' }));
        loadData();
      } else {
        setUploadStatus(s => ({ ...s, [docType]: result.error || 'Upload failed' }));
      }
    } catch (err: unknown) {
      setUploadStatus(s => ({ ...s, [docType]: err instanceof Error ? err.message : 'Upload failed' }));
    }
  };

  const handleRequestRec = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!app) return;
    setRecLoading(true);
    setError('');
    try {
      await api.recommendations.request(app.id, recName, recEmail);
      setRecName('');
      setRecEmail('');
      loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request recommendation');
    } finally {
      setRecLoading(false);
    }
  };

  const statusInfo = app ? STATUS_STEPS[app.status] ?? STATUS_STEPS.submitted : null;
  const isOfferExtended = app?.status === 'accepted' || canonicalStatus === 'OFFER_EXTENDED' || canonicalStatus === 'CONDITIONAL';
  const isProvisioned = provisioningData?.status === 'completed' || ['PROVISIONED', 'REGISTRATION_ELIGIBLE', 'REGISTERED', 'OFFICIALLY_ENROLLED'].includes(canonicalStatus);

  if (loading) return (
    <div className="page-center">
      <div className="spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div className="page" style={{ padding: '5rem 1.5rem 3rem', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 900, marginBottom: '0.5rem' }}>
          My Application & Enrollment Status
        </h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Welcome back, {user?.first_name}. System State: <strong style={{ color: 'var(--navy)', fontFamily: 'monospace' }}>{canonicalStatus}</strong>
        </p>

        {params.get('submitted') && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }} role="alert">
            🎉 Your application has been successfully submitted! Our admissions committee is reviewing your materials.
          </div>
        )}

        {actionSuccess && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }} role="alert">
            {actionSuccess}
          </div>
        )}

        {error && <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }} role="alert">{error}</div>}

        {!app ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
            <h2 style={{ marginBottom: '0.5rem' }}>No Application Found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>You haven't submitted an application yet.</p>
            <a href="/apply" className="btn btn-gold">Start Application →</a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* ─── 1. Primary Status Header ─── */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h2 style={{ marginBottom: '0.25rem' }}>{app.program}</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'capitalize', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span>{app.degree_level} Program</span>
                    <span style={{ fontWeight: 700, color: 'var(--navy)', background: 'var(--slate-light)', padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      Ref: {app.application_number || app.id.slice(0, 8).toUpperCase()}
                    </span>
                  </p>
                </div>
                <div>
                  <span className={`badge badge-${app.status}`} style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
                    {statusInfo?.icon} {statusInfo?.label}
                  </span>
                </div>
              </div>

              {app.reviewer_notes && (
                <div className="alert alert-info" style={{ marginBottom: '1.5rem', background: '#eff6ff', borderLeft: '4px solid #3b82f6', padding: '1rem' }}>
                  <strong style={{ color: '#1e40af', display: 'block', marginBottom: '0.25rem' }}>💬 Admissions Committee Message:</strong>
                  <p style={{ margin: 0, color: '#1e3a8a', fontSize: '0.9rem' }}>{app.reviewer_notes}</p>
                </div>
              )}

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ background: 'var(--border)', borderRadius: 999, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${isProvisioned ? 100 : (statusInfo?.pct ?? 30)}%`,
                    background: isProvisioned ? 'var(--success)' : (app.status === 'accepted' ? 'var(--gold)' : 'var(--navy)'),
                    height: '100%',
                    borderRadius: 999,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {[
                  { label: 'Submitted', active: true, icon: '📄' },
                  { label: 'Review', active: ['under_review', 'accepted', 'rejected'].includes(app.status), icon: '🔍' },
                  { label: 'Offer', active: app.status === 'accepted', icon: '🎓' },
                  { label: 'Enrollment', active: isProvisioned, icon: '✅' },
                ].map((step, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem' }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: step.active ? 'var(--navy)' : 'var(--border)',
                      color: step.active ? 'var(--gold)' : 'var(--slate)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {step.icon}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: step.active ? 'var(--navy)' : 'var(--slate)', fontWeight: step.active ? 700 : 500 }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* ─── 2. Offer Acceptance & Deposit Card (when offer is extended) ─── */}
            {isOfferExtended && !isProvisioned && (
              <div className="card" style={{ border: '2px solid var(--gold)', background: '#fffdfa' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '1.75rem' }}>🎉</span>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--navy)' }}>Congratulations! Official Admission Offer Extended</h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      BMI University is pleased to offer you admission into the <strong>{app.program}</strong> program.
                    </p>
                  </div>
                </div>

                {decision?.conditions && (
                  <div className="alert alert-warning" style={{ marginBottom: '1.25rem' }}>
                    <strong>Admission Conditions:</strong>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.875rem' }}>
                      {typeof decision.conditions === 'string' ? decision.conditions : JSON.stringify(decision.conditions)}
                    </div>
                  </div>
                )}

                {decision?.payment?.required && (
                  <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
                    <strong>Registration fee required:</strong>{' '}
                    {decision?.payment?.formatted || decision?.deposit_amount || ''} — pay securely via the gateway before accepting.
                    <div style={{ marginTop: '0.75rem' }}>
                      <button
                        className="btn btn-navy"
                        onClick={handlePayDeposit}
                        disabled={depositBusy}
                        style={{ padding: '0.6rem 1.25rem', fontWeight: 700 }}
                      >
                        {depositBusy ? '⏳ Processing…' : 'Pay Registration Fee via Gateway'}
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                  <button
                    className="btn btn-gold"
                    onClick={handleAcceptOffer}
                    disabled={acceptingOffer}
                    style={{ flex: 1, minWidth: 200, padding: '0.75rem 1.5rem', fontWeight: 700 }}
                  >
                    {acceptingOffer ? '⏳ Setting up your identity...' : '✓ Accept Admission Offer'}
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={handleDeclineOffer}
                    disabled={acceptingOffer}
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    Decline Offer
                  </button>
                </div>
              </div>
            )}

            {/* ─── 3. Auto-Provisioning Progress Card (Section 2 Saga) ─── */}
            {provisioningData && provisioningData.status !== 'completed' && (
              <div className="card" style={{ borderLeft: '4px solid var(--navy)', background: '#f8fafc' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span>⚙️</span> Setting Up Your Institutional Identity...
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
                  Please wait a moment while your permanent student UID, accounts, advisor assignment, and admission documents are generated.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {provisioningData.steps.map(s => (
                    <div key={s.step} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', background: 'white', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--navy)', fontWeight: 600 }}>{s.label}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: s.status === 'completed' ? 'var(--success)' : s.status === 'in_progress' ? 'var(--gold)' : 'var(--slate)' }}>
                        {s.status === 'completed' ? '✓ Ready' : s.status === 'in_progress' ? '⏳ In progress...' : s.status === 'skipped' ? '⊘ Deferred' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── 4. Provisioned Welcome & Handoff to Course Registration ─── */}
            {isProvisioned && (
              <div className="card" style={{ border: '2px solid var(--success)', background: '#f0fdf4' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '2rem' }}>🎓</span>
                  <div>
                    <h3 style={{ margin: 0, color: '#166534' }}>Welcome to BMI University!</h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#15803d', fontSize: '0.875rem' }}>
                      Your identity and institutional credentials have been provisioned. You are ready to register for courses.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Registration Number</span>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--navy)', fontFamily: 'monospace', marginTop: '0.25rem' }}>
                      {provisioningData?.regNo || 'Pending Issuance'}
                    </div>
                  </div>

                  <div style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Enrolment Status</span>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#166534', marginTop: '0.25rem' }}>
                      {provisioningData?.status === 'ready' ? 'Active / Provisioned' : 'In Progress'}
                    </div>
                  </div>

                  <div style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Contact Email</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e40af', marginTop: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user?.email || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-navy"
                    onClick={() => navigate('/registration')}
                    style={{ flex: 1, minWidth: 220, padding: '0.85rem 1.5rem', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    <span>Proceed to Course Registration & Fee Agreement</span> →
                  </button>
                </div>
              </div>
            )}

            {/* ─── 5. Timeline ─── */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Application Activity Timeline</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 600 }}>
                  {logs.length > 0 ? `${logs.length} update(s)` : 'Initial Submission'}
                </span>
              </div>

              <div style={{ position: 'relative', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ position: 'absolute', left: 7, top: 10, bottom: 10, width: 2, background: 'var(--border)', zIndex: 0 }} />

                {(logs.length > 0 ? logs : [
                  {
                    old_status: null,
                    new_status: app.status || 'submitted',
                    notes: 'Application submitted successfully. Currently queued for admissions committee review.',
                    changed_at: app.submitted_at || app.created_at || new Date().toISOString(),
                  }
                ]).map((log: any, i: number) => {
                  const isLatest = i === 0;
                  const dateStr = log.changed_at ? new Date((log.changed_at) + (log.changed_at?.endsWith('Z') ? '' : 'Z')).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recently';

                  return (
                    <div key={i} style={{ position: 'relative', zIndex: 1, display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: isLatest ? 'var(--gold)' : 'white',
                        border: `3px solid ${isLatest ? 'var(--navy)' : 'var(--slate)'}`,
                        marginTop: '0.2rem',
                        flexShrink: 0,
                        boxShadow: isLatest ? '0 0 0 3px rgba(212, 175, 55, 0.25)' : 'none'
                      }} />
                      <div style={{ flex: 1, background: isLatest ? 'rgba(212, 175, 55, 0.05)' : 'var(--bg)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${isLatest ? 'rgba(212, 175, 55, 0.3)' : 'var(--border)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--navy)', textTransform: 'capitalize' }}>
                            {log.old_status ? `${log.old_status.replace('_', ' ')} → ` : ''}{(log.new_status || 'submitted').replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate)', fontWeight: 500 }}>
                            {dateStr}
                          </span>
                        </div>
                        {log.notes && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>
                            {log.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ─── 6. Recommendations ─── */}
            <div className="card">
              <h3 style={{ marginBottom: '0.25rem' }}>Letters of Recommendation</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                Enter the contact information of your referee. They will receive a secure link to upload their recommendation letter.
              </p>
              
              {recs.length < 3 && (
                <form onSubmit={handleRequestRec} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label" htmlFor="rec-name">Referee Name</label>
                    <input id="rec-name" className="form-input" required value={recName} onChange={e => setRecName(e.target.value)} placeholder="Dr. Jane Smith" />
                  </div>
                  <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                    <label className="form-label" htmlFor="rec-email">Referee Email</label>
                    <input id="rec-email" className="form-input" type="email" required value={recEmail} onChange={e => setRecEmail(e.target.value)} placeholder="jane.smith@example.com" />
                  </div>
                  <button type="submit" className="btn btn-navy" disabled={recLoading}>
                    {recLoading ? 'Sending...' : 'Send Request'}
                  </button>
                </form>
              )}

              {recs.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Referee</th><th>Status</th><th>Requested</th></tr></thead>
                    <tbody>
                      {recs.map(r => (
                        <tr key={r.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.referee_name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.referee_email}</div>
                          </td>
                          <td>
                            <span className={`badge ${r.status === 'submitted' ? 'badge-accepted' : 'badge-under_review'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td>{new Date(r.requested_at + 'Z').toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ─── 7. Supporting Documents ─── */}
            {app.status !== 'rejected' && (
              <div className="card">
                <h3 style={{ marginBottom: '0.25rem' }}>Supporting Documents</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Upload your transcripts and ID documents. Accepted formats: PDF, JPEG, PNG. Max 10 MB.
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <label htmlFor="doc-type-select" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>Document type</label>
                  <select id="doc-type-select" className="form-select" style={{ width: 'auto' }} value={docType} onChange={e => setDocType(e.target.value)}>
                    {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                  </select>
                  <button className="btn btn-outline" onClick={() => fileRef.current?.click()} aria-label="Upload document">
                    📎 Upload Document
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={handleUpload} style={{ display: 'none' }} aria-hidden="true" />
                  {uploadStatus[docType] && (
                    <span className={`alert ${uploadStatus[docType] === 'done' ? 'alert-success' : uploadStatus[docType] === 'uploading' ? 'alert-info' : 'alert-danger'}`} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }} role="status">
                      {uploadStatus[docType] === 'uploading' ? '⏳ Uploading...' : uploadStatus[docType] === 'done' ? '✓ Uploaded!' : uploadStatus[docType]}
                    </span>
                  )}
                </div>
                {app.documents && app.documents.length > 0 ? (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Document Type</th><th>File Name</th><th>Uploaded</th></tr></thead>
                      <tbody>
                        {app.documents.map(d => (
                          <tr key={d.id}>
                            <td><span className={`badge ${d.doc_type === 'recommendation' ? 'badge-waitlisted' : 'badge-submitted'}`}>{d.doc_type.replace('_', ' ')}</span></td>
                            <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.file_name}</td>
                            <td>{new Date(d.uploaded_at + 'Z').toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: 'var(--slate)', fontSize: '0.875rem' }}>No documents uploaded yet.</p>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
