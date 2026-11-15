import { useState } from 'react';

export default function AlumniDashboard() {
  const [forwardEmail, setForwardEmail] = useState('');
  
  const handleTransition = async () => {
    const res = await fetch('/api/alumni/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forwardEmail }),
    });
    if (res.ok) {
      alert('Transitioned to Alumni status successfully.');
    } else {
      alert('Failed to transition.');
    }
  };

  return (
    <div style={{ maxWidth: 1140, margin: '0 auto', padding: '2rem 1.5rem' }}>
      
      {/* ─── Page Title Header ─── */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--gold)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
          ✦ BMI GLOBAL ALUMNI NETWORK
        </div>
        <h1 style={{ fontSize: '2.25rem', color: 'var(--navy)', marginBottom: '0.25rem', fontWeight: 900 }}>
          Alumni Portal
        </h1>
        <p style={{ color: 'var(--slate)', fontSize: '1rem' }}>
          Welcome back to your lifelong academic and ministry fellowship community.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '1.5rem' }}>
        
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ borderTop: '4px solid var(--gold)' }}>
            <h2 style={{ fontSize: '1.35rem', color: 'var(--navy)', marginBottom: '0.5rem', fontWeight: 800 }}>
              Welcome Alumni!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              As an alumnus, you have limited access to request transcripts and update your contact information. You retain perpetual access to library databases, alumni ministry forums, and lifelong email forwarding.
            </p>

            <div style={{ background: 'var(--bg)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.9rem', color: 'var(--navy)', marginBottom: '0.5rem' }}>
                Set Email Forwarding
              </label>
              <input 
                type="email" 
                placeholder="personal@email.com" 
                className="form-input"
                style={{ width: '100%', marginBottom: '1rem' }}
                value={forwardEmail}
                onChange={e => setForwardEmail(e.target.value)}
              />
              <button 
                onClick={handleTransition}
                className="btn btn-gold btn-sm"
                style={{ fontWeight: 700 }}
              >
                Save Alumni Preferences
              </button>
            </div>
          </div>

          {/* Lifelong Alumni Benefits Grid */}
          <div className="card">
            <h2 style={{ fontSize: '1.2rem', color: 'var(--navy)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              🏛️ Lifelong Alumni Privileges & Resources
            </h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>📜</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Alumni Transcripts</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate)', margin: '0.25rem 0 0.75rem 0' }}>
                  Request certified electronic or paper official transcripts for graduate schools or ordination.
                </p>
                <a href="/documents" className="btn btn-outline btn-sm">Order Transcripts →</a>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.3rem' }}>📖</div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--navy)' }}>Theological Digital Library</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--slate)', margin: '0.25rem 0 0.75rem 0' }}>
                  Lifelong access to JSTOR, ATLA Religion Database, and BMI Digital Theological Collections.
                </p>
                <button onClick={() => alert('Accessing BMI Alumni Digital Theological Repository...')} className="btn btn-navy btn-sm">Access Library →</button>
              </div>
            </div>
          </div>

        </div>

        {/* Sidebar Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', color: 'white' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--gold)', marginBottom: '0.5rem' }}>Global Fellowship Directory</h3>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
              Connect with over 4,500 BMI alumni serving across 60+ nations in ministry leadership and academic scholarship.
            </p>
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
              📧 alumni-relations@bmiuniversities.org
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
