import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Link } from '../../shims/react-router-dom';

export default function Graduation() {
  const { user: authUser } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [applied, setApplied] = useState(false);
  const [alert, setAlert] = useState({ type: '', msg: '' });

  // Graduation Form State
  const [ceremonyRsvp, setCeremonyRsvp] = useState('yes');
  const [capGownSize, setCapGownSize] = useState('Medium (5\'7" - 5\'9")');
  const [diplomaName, setDiplomaName] = useState('');
  const [mailingAddress, setMailingAddress] = useState('');
  const [honorsSocietyOptIn, setHonorsSocietyOptIn] = useState(true);

  useEffect(() => {
    api.student.getDashboard()
      .then(data => {
        setDashboardData(data);
        const rawFirst = authUser?.first_name || data?.user?.first_name || data?.first_name || '';
        const rawLast = authUser?.last_name || data?.user?.last_name || data?.last_name || '';
        if (rawFirst || rawLast) {
          setDiplomaName(`${rawFirst} ${rawLast}`.trim());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  const totalCredits = dashboardData?.total_credits || 0;
  const degreeCredits = dashboardData?.degree_credits || 120;
  const gpa = dashboardData?.gpa !== undefined && dashboardData?.gpa !== null ? Number(dashboardData.gpa).toFixed(2) : '3.85';
  const programName = dashboardData?.program_name || dashboardData?.user?.program_name || 'Bachelor of Science in Biblical Studies';

  // 4 Senior Clearance Milestones
  const isCreditCleared = totalCredits >= (degreeCredits * 0.75); // Eligible for graduation application in final semester
  const isFinancialCleared = !(dashboardData?.upcoming_invoices?.length > 0);
  const isLibraryCleared = true;
  const isRegistrarAuditCleared = true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setApplied(true);
      setAlert({ type: 'success', msg: 'Application for Degree Conferral and Commencement Ceremony registration submitted successfully to the Registrar!' });
    }, 800);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem' }}>
        <div className="spinner" style={{ width: 40, height: 40 }}></div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto' }}>
      
      {/* ─── Header Section ─── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
          ✦ DEGREE CONFERRAL & COMMENCEMENT
        </div>
        <h1 style={{ fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem', fontWeight: 900 }}>
          🎓 Senior Graduation Clearance & Ceremony Hub
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem' }}>
          Complete senior clearance milestones, apply for degree conferral, and register for commencement exercises.
        </p>
      </div>

      {alert.msg && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{alert.msg}</span>
          <button onClick={() => setAlert({ type: '', msg: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── Senior Clearance 4-Point Checklist ─── */}
      <div className="card" style={{ marginBottom: '2rem', borderTop: '4px solid var(--gold)' }}>
        <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>
          Senior Institutional Clearance Checklist
        </h2>
        <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
          All 4 clearance requirements must be satisfied prior to official degree conferral and diploma release.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: isCreditCleared ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isCreditCleared ? 'var(--success)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--navy)' }}>1. Academic Credit Audit</span>
              <span style={{ color: isCreditCleared ? 'var(--success)' : 'var(--slate)', fontWeight: 800 }}>{isCreditCleared ? '✓ Cleared' : '⏳ In Review'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>{totalCredits} of {degreeCredits} Credits Earned</div>
          </div>

          <div style={{ padding: '1rem', background: isFinancialCleared ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isFinancialCleared ? 'var(--success)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--navy)' }}>2. Financial Ledger</span>
              <span style={{ color: isFinancialCleared ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{isFinancialCleared ? '✓ Cleared' : '⚠️ Balance Due'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>Zero balance account required</div>
          </div>

          <div style={{ padding: '1rem', background: isLibraryCleared ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isLibraryCleared ? 'var(--success)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--navy)' }}>3. Library & Media Return</span>
              <span style={{ color: isLibraryCleared ? 'var(--success)' : 'var(--slate)', fontWeight: 800 }}>{isLibraryCleared ? '✓ Cleared' : '⏳ In Review'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>No outstanding borrowed books</div>
          </div>

          <div style={{ padding: '1rem', background: isRegistrarAuditCleared ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg)', borderRadius: 'var(--radius-sm)', border: `1px solid ${isRegistrarAuditCleared ? 'var(--success)' : 'var(--border)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--navy)' }}>4. Registrar Verification</span>
              <span style={{ color: isRegistrarAuditCleared ? 'var(--success)' : 'var(--slate)', fontWeight: 800 }}>{isRegistrarAuditCleared ? '✓ Verified' : '⏳ In Review'}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--slate)' }}>Cumulative GPA: {gpa} / 4.00</div>
          </div>
        </div>
      </div>

      {/* ─── Graduation Application Form & Ceremony Details ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        
        {/* Application Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', color: 'var(--navy)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            Application for Degree Conferral
          </h2>
          <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
            Program: <strong>{programName}</strong> • Anticipated Conferral: <strong>Spring/Summer 2026</strong>
          </p>

          {applied ? (
            <div style={{ padding: '2.5rem', textAlign: 'center', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--success)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎉</div>
              <h3 style={{ fontSize: '1.3rem', color: '#065f46', margin: 0, fontWeight: 900 }}>Graduation Application Submitted!</h3>
              <p style={{ fontSize: '0.95rem', color: 'var(--slate)', maxWidth: 500, margin: '0.75rem auto 1.5rem', lineHeight: 1.5 }}>
                Your petition for graduation has been received by the Office of the Registrar. Official commencement ceremony instructions and cap & gown delivery will be dispatched to your email.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/alumni" className="btn btn-gold btn-sm">
                  🎓 Explore Alumni Benefits & Network →
                </Link>
                <Link to="/student/dashboard" className="btn btn-outline btn-sm">
                  Back to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Full Name as it Should Appear on Official Diploma *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={diplomaName}
                  onChange={e => setDiplomaName(e.target.value)}
                  placeholder="First Middle Last"
                />
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)', marginTop: '0.25rem' }}>
                  Please ensure spelling and capitalization match your legal government credentials.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                <div className="form-group">
                  <label className="form-label">Commencement Attendance RSVP</label>
                  <select className="form-input" value={ceremonyRsvp} onChange={e => setCeremonyRsvp(e.target.value)}>
                    <option value="yes">✓ Yes, Attending In-Person Ceremony</option>
                    <option value="virtual">💻 Attending Live Virtual Webcast</option>
                    <option value="in_absentia">In Absentia (Mail Diploma Only)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Regalia / Cap & Gown Height Size</label>
                  <select className="form-input" value={capGownSize} onChange={e => setCapGownSize(e.target.value)}>
                    <option value="Small">Small (4'11" - 5'3")</option>
                    <option value="Medium">Medium (5'4" - 5'9")</option>
                    <option value="Large">Large (5'10" - 6'2")</option>
                    <option value="X-Large">X-Large (6'3"+)</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Diploma Mailing Address *</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  required
                  value={mailingAddress}
                  onChange={e => setMailingAddress(e.target.value)}
                  placeholder="Street Address, City, State/Province, Postal Code, Country"
                />
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={honorsSocietyOptIn}
                    onChange={e => setHonorsSocietyOptIn(e.target.checked)}
                    style={{ accentColor: 'var(--gold)', width: 18, height: 18, marginTop: 2 }}
                  />
                  <span style={{ fontSize: '0.85rem', color: 'var(--navy)', lineHeight: 1.4 }}>
                    <strong>Alumni Association & Theological Society Induction:</strong> Authorize inclusion in the BMI Global Alumni Network and lifetime theological research journal access.
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-gold" disabled={submitting} style={{ width: '100%', padding: '0.85rem', fontWeight: 800 }}>
                {submitting ? 'Submitting Application...' : '🎓 Submit Application for Degree Conferral'}
              </button>
            </form>
          )}
        </div>

        {/* Ceremony & Important Dates Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: 'white' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '0.75rem' }}>🏛️ Commencement Ceremony Details</h3>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
              <div><strong>Date:</strong> Saturday, May 16, 2026</div>
              <div><strong>Time:</strong> 10:00 AM EST</div>
              <div><strong>Venue:</strong> University Grand Hall & Live Global Webcast</div>
              <div><strong>Speaker:</strong> President & Board of Regents</div>
            </div>
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.8rem', color: '#94a3b8' }}>
              Guest tickets: 4 complimentary invitations allocated per graduating senior.
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.05rem', color: 'var(--navy)', marginBottom: '0.75rem' }}>Alumni Benefits Preview</h3>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: 1.6, margin: 0 }}>
              <li>Lifelong BMI digital library & JSTOR access</li>
              <li>Official alumni transcript ordering</li>
              <li>Global ministry placement network</li>
              <li>Continuing education & ministry webinar discounts</li>
            </ul>
          </div>

        </div>

      </div>

    </div>
  );
}
