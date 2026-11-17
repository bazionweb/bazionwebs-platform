// src/pages/Landing.tsx
import { Link } from '../shims/react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from '../lib/contracts-bridge';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';

const features = [
  { icon: '📋', title: 'Easy Online Application', desc: 'Complete your application in minutes with our guided multi-step form.' },
  { icon: '📁', title: 'Secure Document Upload', desc: 'Safely submit transcripts and identity documents directly to your application.' },
  { icon: '🔔', title: 'Real-Time Status Updates', desc: 'Track your application progress and receive email notifications at every step.' },
  { icon: '🔐', title: 'Secure & Private', desc: "Your data is encrypted and stored securely on Cloudflare's global infrastructure." },
];

export default function Landing() {
  const { user } = useAuth();

  // ── DB-as-SSOT: hydrate programs from the public catalog endpoint.
  //    Fallback guarantees first-paint content and offline/test resilience.
  const [programCatalog, setProgramCatalog] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/programs`);
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) return;
        if (cancelled) return;
        setProgramCatalog(body.data.map((p: any) => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const programs = useMemo(() => [
    { level: 'Bachelor\'s', programs: programCatalog.filter(p => p.level === 'undergraduate').map(p => p.label).slice(0, 3) },
    { level: 'Master\'s', programs: programCatalog.filter(p => p.level === 'graduate').map(p => p.label).slice(0, 3) },
    { level: 'Doctorate', programs: programCatalog.filter(p => p.level === 'doctorate').map(p => p.label).slice(0, 2) },
    { level: 'Diploma & Certificate', programs: programCatalog.filter(p => p.level === 'diploma' || p.level === 'certificate').map(p => p.label).slice(0, 2) },
  ], [programCatalog]);

  return (
    <div>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)', minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: 80 }}>
        <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: 999, padding: '0.4rem 1.2rem', marginBottom: '1.5rem' }}>
            <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              🎓 BMI University Admissions Portal
            </span>
          </div>
          <h1 style={{ color: 'white', fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Begin Your Journey<br />
            <span style={{ color: 'var(--gold)' }}>Toward God's Calling</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1.2rem', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Apply to BMI University's Christ-centered degree programs. Track your application, upload documents, and receive real-time updates — all in one place.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <Link to={user.role === 'admin' || user.role === 'staff' ? '/admin' : '/status'} className="btn btn-gold" style={{ fontSize: '1.05rem', padding: '1rem 2.5rem' }}>
                Go to Dashboard →
              </Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-gold" style={{ fontSize: '1.05rem', padding: '1rem 2.5rem' }}>
                  Apply Now →
                </Link>
                <Link to="/login" className="btn btn-outline" style={{ fontSize: '1.05rem', padding: '1rem 2.5rem', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}>
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '6rem 0', background: 'var(--bg)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', marginBottom: '1rem' }}>A Better Admissions Experience</h2>
            <div className="gold-bar" style={{ margin: '0 auto' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {features.map((f) => (
              <div key={f.title} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{f.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem', marginBottom: '0.5rem' }}>{f.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programs */}
      <section style={{ padding: '6rem 0', background: 'var(--navy)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <h2 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'white', marginBottom: '1rem' }}>Available Programs</h2>
            <div className="gold-bar" style={{ margin: '0 auto' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
            {programs.map((g) => (
              <div key={g.level} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-lg)', padding: '2rem' }}>
                <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>{g.level}</div>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {g.programs.map(p => (
                    <li key={p} style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ color: 'var(--gold)' }}>›</span> {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '3rem' }}>
            <Link to="/register" className="btn btn-gold" style={{ fontSize: '1.05rem', padding: '1rem 2.5rem' }}>
              Start Your Application →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: '#060d1a', padding: '2.5rem 1.5rem', textAlign: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>
          © {new Date().getFullYear()} BMI University. All Rights Reserved. |{' '}
          <a href="mailto:admissions@bmiuniversities.org" style={{ color: 'rgba(255,255,255,0.4)' }}>admissions@bmiuniversities.org</a>
        </p>
      </footer>
    </div>
  );
}
