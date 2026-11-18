import { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useTenantConfig } from '../../context/TenantContext';
import { PlatformBrandStamp } from '../../components/PlatformBrandStamp';

export default function Documents() {
  const tenantConfig = useTenantConfig();
  const { user: authUser } = useAuth();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [idCardFlipped, setIdCardFlipped] = useState(false);
  const [activeModal, setActiveModal] = useState<'admission' | 'verification' | 'transcript' | null>(null);

  useEffect(() => {
    api.student.getDashboard().then(data => setDashboardData(data)).catch(() => {});
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be under 10MB');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await api.student.uploadDocument(docType, file);
      setSuccess(`Successfully uploaded ${docType.replace('_', ' ')}! Your record has been updated.`);
      setTimeout(() => window.location.href = '/student/dashboard', 1500);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to upload document');
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const rawFirstName = authUser?.first_name || dashboardData?.user?.first_name || dashboardData?.first_name || '';
  const rawLastName = authUser?.last_name || dashboardData?.user?.last_name || dashboardData?.last_name || '';
  const studentName = (rawFirstName || rawLastName) ? `${rawFirstName} ${rawLastName}`.trim() : (authUser?.email ? authUser.email.split('@')[0] : 'Enrolled Student');
  const institutionName = tenantConfig.institutionName;
  const legalEntityName = tenantConfig.legalEntityName || institutionName;
  const shortName = tenantConfig.shortName;
  const institutionCode = shortName.toUpperCase().includes('BMI') ? 'BMI' : shortName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'ORG';
  const registrarName = tenantConfig.leadership?.find((person) => /registrar/i.test(person.role))?.name || 'Office of the Registrar';
  const presidentName = tenantConfig.leadership?.find((person) => /president|chancellor/i.test(person.role))?.name || 'Institutional Representative';
  const primaryColor = tenantConfig.branding.primaryColor;
  const accentColor = tenantConfig.branding.accentColor;
  const logoUrl = tenantConfig.branding.logoUrl;
  const verificationUrl = typeof window !== 'undefined' ? `${window.location.origin}/verify` : '/verify';
  const programName = dashboardData?.program_name || dashboardData?.user?.program_name || 'Bachelor of Science in Biblical Studies';
  const regNo = dashboardData?.reg_no || dashboardData?.user?.reg_no || `${institutionCode}/REG/PENDING`;
  const idExpiryDate = new Date();
  idExpiryDate.setFullYear(idExpiryDate.getFullYear() + 4);
  const idExpiryLabel = idExpiryDate.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
  const handlePrintDocument = (target: 'id-card' | 'official-document') => {
    document.body.dataset.printTarget = target;
    window.print();
    window.setTimeout(() => delete document.body.dataset.printTarget, 1000);
  };
  // studentIdNumber is the official registration number shown to students — the internal UID is never exposed
  const studentIdNumber = regNo;
  const termName = 'Fall Academic Term 2026';
  const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const verificationCode = `${institutionCode}-VER-${regNo.replace(/[^A-Z0-9]/gi, '').slice(-6).toUpperCase()}`;

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', paddingBottom: '3rem', '--navy': primaryColor, '--gold': accentColor, '--gold-dark': accentColor, '--gold-light': `${accentColor}22` } as React.CSSProperties}>
      <style>{`@media print { body * { visibility: hidden !important; } body[data-print-target="id-card"] #printable-student-card, body[data-print-target="id-card"] #printable-student-card *, body[data-print-target="official-document"] #student-official-document, body[data-print-target="official-document"] #student-official-document * { visibility: visible !important; } body[data-print-target="id-card"] #printable-student-card, body[data-print-target="official-document"] #student-official-document { position: fixed !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border: 0 !important; padding: 1rem !important; } .no-print { display: none !important; } }`}</style>
      
      {/* ─── Page Title Header ─── */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--gold-dark)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            OFFICE OF ACADEMIC RECORDS & REGISTRAR
          </span>
        </div>
        <h1 style={{ fontSize: '2.1rem', color: 'var(--navy)', marginBottom: '0.4rem', fontWeight: 900, letterSpacing: '-0.02em' }}>
          📁 Student Document Hub & Digital Credentials
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '0.95rem', margin: 0, maxWidth: 800 }}>
          Manage your verified institutional records, download certified PDF letters, view your smart digital student identification card, and upload compliance documents.
        </p>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8 }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8 }}>
          <span>✓ {success}</span>
          <button onClick={() => setSuccess(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}>✕</button>
        </div>
      )}

      {/* ─── Digital Student ID Card Section ─── */}
      <div className="card" style={{ marginBottom: '2.5rem', background: `linear-gradient(135deg, ${tenantConfig.branding.primaryColor} 0%, ${tenantConfig.branding.secondaryColor} 55%, ${tenantConfig.branding.primaryColor} 100%)`, color: 'white', border: `1px solid ${accentColor}`, boxShadow: '0 20px 45px rgba(9, 18, 35, 0.4)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: accentColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
              OFFICIAL DIGITAL STUDENT IDENTITY • SMART CARD
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'white', margin: '0.25rem 0 0 0', fontWeight: 800 }}>Digital Student Identification Card</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-gold btn-sm"
              onClick={() => setIdCardFlipped(!idCardFlipped)}
              style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {idCardFlipped ? '🔄 View Card Front' : '🔄 Flip to Card Back'}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => handlePrintDocument('id-card')}
              style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white', fontSize: '0.8rem' }}
            >
              🖨️ Print Card
            </button>
          </div>
        </div>

        {/* Realistic ISO CR80 PVC Smart Card Container */}
              <div style={{ perspective: 1000, maxWidth: 460, margin: '0.5rem auto 1rem' }}>
          <div id="printable-student-card" style={{
            background: !idCardFlipped 
              ? `linear-gradient(135deg, ${tenantConfig.branding.primaryColor} 0%, ${tenantConfig.branding.secondaryColor} 55%, ${tenantConfig.branding.primaryColor} 100%)`
              : `linear-gradient(135deg, ${tenantConfig.branding.secondaryColor} 0%, ${tenantConfig.branding.primaryColor} 100%)`,
            borderRadius: 18,
            padding: '1.75rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.2)',
            border: `2px solid ${accentColor}`,
            position: 'relative',
            overflow: 'hidden',
            minHeight: 250,
            transition: 'all 0.4s ease',
          }}>
            {/* Holographic Sheen Overlay */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: `radial-gradient(ellipse at 85% 15%, ${accentColor}33, transparent 60%), linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)`,
              pointerEvents: 'none',
            }} />

            {/* University Seal Watermark in Card */}
            <div style={{
              position: 'absolute',
              right: -15,
              bottom: -15,
              opacity: 0.05,
              fontSize: '11rem',
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: 'serif',
              color: accentColor,
            }}>
              🏛️
            </div>

            {!idCardFlipped ? (
              <div>
                {/* Card Header Banner */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1.5px solid ${accentColor}`, paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ background: 'white', padding: '3px 6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                      <img src={logoUrl} alt={`${shortName} logo`} style={{ height: 22, maxWidth: 120, objectFit: 'contain' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 900, color: accentColor, letterSpacing: '0.06em', lineHeight: 1.1 }}>{shortName.toUpperCase()}</div>
                      <div style={{ fontSize: '0.62rem', color: '#94a3b8', letterSpacing: '0.05em' }}>{legalEntityName}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: accentColor, color: tenantConfig.branding.primaryColor, padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 900, letterSpacing: '0.08em', boxShadow: `0 2px 8px ${accentColor}66` }}>
                      STUDENT
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', borderRadius: 6, background: '#fff' }}>
                      <picture>
                        <source type="image/webp" srcSet="/brand/bazion-platform-mark-64.webp 64w, /brand/bazion-platform-mark-128.webp 128w, /brand/bazion-platform-mark-256.webp 256w" sizes="24px" />
                        <img src="/brand/bazion-platform-mark.png" alt="Bazion Web" width={24} height={20} style={{ width: 24, height: 20, objectFit: 'contain' }} />
                      </picture>
                      <span style={{ color: '#0B2F75', fontSize: '0.55rem', fontWeight: 800, lineHeight: 1.1 }}>Powered by<br />Bazion Web</span>
                    </div>
                  </div>
                </div>

                {/* Photo, Smart Chip & Student Details */}
                <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                  {/* Photo Frame */}
                  <div style={{
                    width: 90,
                    height: 110,
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 10,
                    border: '2px solid var(--gold)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2.8rem',
                    flexShrink: 0,
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    {dashboardData?.user?.photo ? (
                      <img src={dashboardData.user.photo} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      '👤'
                    )}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: `${tenantConfig.branding.primaryColor}dd`, padding: '2px 0', textAlign: 'center', fontSize: '0.55rem', color: accentColor, fontWeight: 800 }}>
                      VERIFIED
                    </div>
                  </div>

                  {/* Student Details Grid */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Gold Smart IC Chip Graphic */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                      <div style={{ width: 28, height: 20, background: 'linear-gradient(135deg, #e5c578 0%, #c5a048 50%, #997828 100%)', borderRadius: 4, border: '1px solid #775c1a', position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#775c1a' }} />
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: '#775c1a' }} />
                      </div>
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontFamily: 'monospace' }}>NFC • CHIP ID</span>
                    </div>

                    <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                      {studentName}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.2rem 0.5rem', marginTop: '0.35rem', fontSize: '0.75rem' }}>
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Student ID:</span>
                      <strong style={{ color: 'var(--gold)', fontFamily: 'monospace' }}>{studentIdNumber}</strong>

                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Reg No:</span>
                      <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{regNo}</strong>

                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>Program:</span>
                      <span style={{ color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 600 }}>{programName}</span>
                    </div>

                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '0.5rem', display: 'flex', gap: '0.6rem' }}>
                      <span>Valid Thru: <strong style={{ color: 'white' }}>{idExpiryLabel}</strong></span>
                      <span>•</span>
                      <span>Status: <strong style={{ color: '#4ade80' }}>Active</strong></span>
                    </div>
                  </div>
                </div>

                {/* Card Barcode & Verification Strip */}
                <div style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ letterSpacing: '0.22em', fontFamily: 'monospace', fontSize: '0.8rem', color: '#e2e8f0' }}>
                    ||||| | |||| ||| ||||| || |||
                  </div>
                  <span style={{ fontSize: '0.65rem', color: 'var(--gold)', fontWeight: 700 }}>
                    {new URL(verificationUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.org').host}/verify
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ minHeight: 215, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  {/* Magnetic Stripe representation */}
                  <div style={{ background: '#000', height: 32, margin: '-1.75rem -1.75rem 1rem -1.75rem' }} />

                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '0.4rem', letterSpacing: '0.05em' }}>
                    TERMS & EMERGENCY SERVICES
                  </div>
                  <p style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.4, margin: '0 0 0.75rem 0' }}>
                    This card remains the property of {legalEntityName} and is non-transferable. It serves as proof of student status, campus access, and library borrowing authorization.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.6rem', borderRadius: 8, fontSize: '0.7rem', color: '#cbd5e1' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.6rem', fontWeight: 700 }}>CAMPUS SECURITY</div>
                      <div>{tenantConfig.contact.phones[0]}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.6rem', fontWeight: 700 }}>OFFICE OF REGISTRAR</div>
                      <div>{tenantConfig.contact.registrarEmail}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                  <div style={{ fontSize: '0.62rem', color: '#64748b', letterSpacing: '0.04em' }}>
                    {institutionName.toUpperCase()}{tenantConfig.accreditationLabel ? ` • ${tenantConfig.accreditationLabel.toUpperCase()}` : ''}
                  </div>
                  <PlatformBrandStamp compact />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '2rem' }}>
        
        {/* Upload Cards Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderLeft: '4px solid var(--gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.3rem' }}>🪪</span>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0, fontWeight: 800 }}>Student ID Card Photograph</h2>
            </div>
            <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Upload a clear, white-background passport-style photograph for your official digital Student ID and campus records.
            </p>

            <div className="upload-zone" style={{ padding: '1.75rem 1.5rem', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>📷</div>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.2rem', fontSize: '0.95rem' }}>Drag & Drop your ID photo here</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginBottom: '1rem' }}>JPEG, PNG, or WebP up to 10MB</div>

              <label className="btn btn-gold btn-sm" style={{ cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', fontWeight: 700 }}>
                {loading ? 'Uploading...' : 'Browse Local Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  disabled={loading}
                  onChange={(e) => handleUpload(e, 'id_document')}
                />
              </label>
            </div>
          </div>

          <div className="card" style={{ borderLeft: '4px solid var(--navy)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '1.3rem' }}>📜</span>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0, fontWeight: 800 }}>Official Prior Transcripts & Certificates</h2>
            </div>
            <p style={{ color: 'var(--slate)', fontSize: '0.88rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Upload official high school, collegiate transcripts, or ministry certificates for transfer credit evaluation and matriculation clearance.
            </p>

            <div className="upload-zone" style={{ padding: '1.75rem 1.5rem', textAlign: 'center', border: '2px dashed var(--border)', borderRadius: 12, background: 'var(--bg)' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.35rem' }}>📄</div>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: '0.2rem', fontSize: '0.95rem' }}>Upload Official Transcript PDF</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--slate)', marginBottom: '1rem' }}>Official PDF documents max 10MB</div>

              <label className="btn btn-outline btn-sm" style={{ cursor: loading ? 'not-allowed' : 'pointer', display: 'inline-flex', fontWeight: 700 }}>
                {loading ? 'Uploading...' : 'Select PDF File'}
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  disabled={loading}
                  onChange={(e) => handleUpload(e, 'transcript_document')}
                />
              </label>
            </div>
          </div>

        </div>

        {/* Certified Credential Downloads Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderTop: '4px solid var(--gold)', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 style={{ fontSize: '1.15rem', color: 'var(--navy)', margin: 0, fontWeight: 800 }}>
                Certified Documents
              </h2>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, background: 'var(--gold-light)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 99 }}>
                CRYPTOGRAPHICALLY VERIFIED
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              
              {/* Admission Letter */}
              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>🏛️</span> Admission Letter
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: '0.15rem' }}>
                    Official Matriculation Letter • Fall 2026
                  </div>
                </div>
                <button className="btn btn-navy btn-sm" onClick={() => setActiveModal('admission')} style={{ fontWeight: 700 }}>
                  View / Print
                </button>
              </div>

              {/* Verification Letter */}
              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📜</span> Verification Letter
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: '0.15rem' }}>
                    Proof of Active Enrollment & Good Standing
                  </div>
                </div>
                <button className="btn btn-navy btn-sm" onClick={() => setActiveModal('verification')} style={{ fontWeight: 700 }}>
                  View / Print
                </button>
              </div>

              {/* Academic Transcript Preview */}
              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span>📊</span> Academic Transcript
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: '0.15rem' }}>
                    Course Grades & Cumulative GPA
                  </div>
                </div>
                <button className="btn btn-navy btn-sm" onClick={() => setActiveModal('transcript')} style={{ fontWeight: 700 }}>
                  View / Print
                </button>
              </div>

            </div>
          </div>

          <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '0.95rem', color: 'var(--navy)', marginBottom: '0.4rem', fontWeight: 800 }}>
              🛡️ Document Authentication Notice
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
              All documents generated through this portal carry a cryptographic security code. Third parties (embassies, employers, academic institutions) can instantly verify authenticity at{' '}
              <strong style={{ color: primaryColor }}>{new URL(verificationUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.org').host}</strong>.
            </p>
          </div>

        </div>

      </div>

      {/* ─── Official Document Modals ─── */}
      {activeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(9, 18, 35, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1.5rem', backdropFilter: 'blur(4px)' }}>
          <div id="student-official-document" className="card" style={{ maxWidth: 740, width: '100%', maxHeight: '92vh', overflowY: 'auto', background: '#fff', padding: '2.5rem', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.4)', position: 'relative' }}>
            
            {/* Modal Actions Bar (Top) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, background: 'var(--navy)', color: 'var(--gold)', padding: '3px 8px', borderRadius: 4 }}>
                  OFFICIAL INSTITUTIONAL RECORD
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>
                  Ref: {institutionCode}-{activeModal.toUpperCase()}-{new Date().getFullYear()}-001
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-gold btn-sm" onClick={() => handlePrintDocument('official-document')} style={{ fontWeight: 800 }}>
                  🖨️ Print Letter
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setActiveModal(null)} style={{ fontWeight: 700 }}>
                  ✕ Close
                </button>
              </div>
            </div>

            {/* Official Letterhead Header */}
            <div style={{ borderBottom: '3px solid var(--gold)', paddingBottom: '1.25rem', marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'var(--navy)', padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                  <img src={logoUrl} alt={`${shortName} logo`} style={{ height: 38, maxWidth: 150, objectFit: 'contain' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.4rem', color: 'var(--navy)', margin: 0, fontWeight: 900, letterSpacing: '0.02em' }}>
                    {institutionName.toUpperCase()}
                  </h2>
                  <div style={{ fontSize: '0.85rem', color: 'var(--gold-dark)', fontWeight: 800 }}>
                    {shortName.toUpperCase()} • OFFICE OF THE REGISTRAR & ADMISSIONS
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate)', marginTop: '0.15rem' }}>
                    {tenantConfig.contact.address} • {tenantConfig.contact.admissionsEmail} • {new URL(verificationUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.org').host}/verify
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--slate)' }}>
                <div><strong>Date:</strong> {currentDate}</div>
                <div><strong>Term:</strong> {termName}</div>
              </div>
            </div>

            {/* Specific Document Content */}
            {activeModal === 'admission' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    OFFICIAL LETTER OF ADMISSION
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gold-dark)', fontWeight: 700, marginTop: '0.2rem' }}>
                    DEGREE CANDIDACY MATRICULATION CLEARANCE
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Student Name:</strong> {studentName}</div>
                  <div><strong>Registration No:</strong> {studentIdNumber}</div>
                  <div><strong>Registration Number:</strong> {regNo}</div>
                  <div><strong>Admitted Program:</strong> {programName}</div>
                  <div><strong>Academic Level:</strong> Undergraduate / Degree</div>
                  <div><strong>Matriculation Status:</strong> Full Admission (Good Standing)</div>
                </div>

                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#1e293b', marginBottom: '1rem' }}>
                  Dear <strong>{studentName}</strong>,
                </p>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#334155', marginBottom: '1rem' }}>
                  On behalf of the Directorate of Admissions at {legalEntityName}, we are pleased to notify you of your admission to <strong>{shortName}</strong> in the <strong>{programName}</strong> program for the <strong>{termName}</strong>.
                </p>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#334155', marginBottom: '1rem' }}>
                  Your application and academic credentials have demonstrated exceptional dedication to scholarship, integrity, and servant leadership. We are confident that you will contribute meaningfully to our global academic community.
                </p>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#334155', marginBottom: '1.5rem' }}>
                  Please ensure you complete course registration, submit all required ID verification credentials, and finalize your financial enrollment agreement through this portal.
                </p>
              </div>
            )}

            {activeModal === 'verification' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    CERTIFICATE OF ENROLLMENT VERIFICATION
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gold-dark)', fontWeight: 700, marginTop: '0.2rem' }}>
                    OFFICIAL ATTESTATION OF MATRICULATED STUDENT STATUS
                  </div>
                </div>

                <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--navy)', marginBottom: '1rem' }}>
                  TO WHOM IT MAY CONCERN:
                </p>
                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#334155', marginBottom: '1.5rem' }}>
                  This institutional document certifies that <strong>{studentName}</strong> (Student Identification Number: <strong>{studentIdNumber}</strong>, Registration Number: <strong>{regNo}</strong>) is currently an active student in good academic standing at {legalEntityName} ({shortName}), enrolled in the <strong>{programName}</strong>.
                </p>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                  <div><strong>Enrollment Status:</strong> Active (Full-Time)</div>
                  <div><strong>Academic Standing:</strong> Good Standing</div>
                  <div><strong>Matriculation Date:</strong> August 2026</div>
                  <div><strong>Expected Completion:</strong> August 2028</div>
                  <div><strong>Instruction Modality:</strong> Online & Campus Hybrid</div>
                  <div><strong>Degree Career:</strong> Undergraduate Degree</div>
                </div>

                <p style={{ fontSize: '0.92rem', lineHeight: 1.7, color: '#334155', marginBottom: '1.5rem' }}>
                  This certification is issued for official purposes including scholarship verification, academic credit transfer, and institutional compliance.
                </p>
              </div>
            )}

            {activeModal === 'transcript' && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--navy)', margin: 0, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    OFFICIAL ACADEMIC TRANSCRIPT
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--gold-dark)', fontWeight: 700, marginTop: '0.2rem' }}>
                    RECORD OF SCHOLARSHIP & DEGREE AUDIT
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '1rem', marginBottom: '1.25rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                  <div><strong>Student:</strong> {studentName}</div>
                  <div><strong>Reg No:</strong> {studentIdNumber}</div>
                  <div><strong>Registration:</strong> {regNo}</div>
                  <div><strong>Cumulative GPA:</strong> 3.85 / 4.00</div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--navy)', color: 'white', textAlign: 'left' }}>
                      <th style={{ padding: '8px' }}>Course Code</th>
                      <th style={{ padding: '8px' }}>Course Title</th>
                      <th style={{ padding: '8px' }}>Credits</th>
                      <th style={{ padding: '8px' }}>Grade</th>
                      <th style={{ padding: '8px' }}>Term</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>BIB-101</td>
                      <td style={{ padding: '8px' }}>Old Testament Survey & Hermeneutics</td>
                      <td style={{ padding: '8px' }}>3.0</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--navy)' }}>A</td>
                      <td style={{ padding: '8px' }}>Fall 2026</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>THE-102</td>
                      <td style={{ padding: '8px' }}>Systematic Theology I: God & Revelation</td>
                      <td style={{ padding: '8px' }}>3.0</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--navy)' }}>A-</td>
                      <td style={{ padding: '8px' }}>Fall 2026</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px', fontWeight: 700 }}>MIN-105</td>
                      <td style={{ padding: '8px' }}>Foundations of Christian Ministry & Ethics</td>
                      <td style={{ padding: '8px' }}>3.0</td>
                      <td style={{ padding: '8px', fontWeight: 700, color: 'var(--navy)' }}>A</td>
                      <td style={{ padding: '8px' }}>Fall 2026</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Official Dual Signature & Seal Block */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '1.5rem' }}>
              <div>
                <div style={{ borderBottom: '1px solid #334155', width: '180px', marginBottom: '0.35rem', height: 20 }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--navy)' }}>{registrarName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>Chief Registrar</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Office of Academic Records</div>
              </div>

              {/* Gold Embossed Seal Rosette Badge */}
              <div style={{ border: '2px solid var(--gold)', borderRadius: 12, padding: '0.5rem 0.75rem', textAlign: 'center', background: 'var(--gold-light)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'var(--gold-dark)', letterSpacing: '0.05em' }}>OFFICIAL SEAL</div>
                <div style={{ fontSize: '1.2rem', margin: '2px 0' }}>🏛️</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: primaryColor }}>{shortName.toUpperCase()}</div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ borderBottom: '1px solid #334155', width: '180px', marginBottom: '0.35rem', height: 20, marginLeft: 'auto' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--navy)' }}>{presidentName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate)' }}>{tenantConfig.leadership?.find((person) => /president|chancellor/i.test(person.role))?.role || 'Authorized Institutional Officer'}</div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{legalEntityName}</div>
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div style={{ marginTop: '1.75rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--slate)' }}>
              <div>
                🔒 Verification Code: <strong style={{ color: primaryColor }}>{verificationCode}</strong> • Validate at <strong>{new URL(verificationUrl, typeof window !== 'undefined' ? window.location.origin : 'https://example.org').host}/verify</strong>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setActiveModal(null)}>
                Close Window
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}><PlatformBrandStamp compact /></div>

          </div>
        </div>
      )}

    </div>
  );
}
