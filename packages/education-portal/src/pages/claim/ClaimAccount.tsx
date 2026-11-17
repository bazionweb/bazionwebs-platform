import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from '../../shims/react-router-dom';
import { api } from '../../lib/api';
import { Check } from '../../shims/lucide-react';

const PASSWORD_REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'One number (0-9)', test: (pw: string) => /[0-9]/.test(pw) },
  { id: 'special', label: 'One special character (!@#$%^&*)', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
];

export default function ClaimAccount() {
  const [searchParams] = useSearchParams();
  const [admissionCode, setAdmissionCode] = useState(searchParams.get('code') || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (searchParams.get('code')) {
      setAdmissionCode(searchParams.get('code') as string);
    }
  }, [searchParams]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');
    try {
      await api.auth.claim(admissionCode, password);
      navigate('/login', { state: { message: 'Account claimed successfully! You can now log in.' } });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to claim account. Code may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-center" style={{ background: 'linear-gradient(150deg, #f8fafc 0%, #eef2ff 50%, #faf5e4 100%)', minHeight: '100vh' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/bmi-logo.png" alt="BMI University" style={{ height: 72, margin: '0 auto 1.5rem' }} />
          <h1 style={{ color: 'var(--navy)', marginBottom: '0.5rem', fontSize: '1.8rem' }}>Activate Student Account</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, padding: '0 1rem' }}>
            Welcome to BMI University! Enter your admission code and set a password to access your portal.
          </p>
        </div>

        <div className="card">

        {searchParams.get('code') && (
          <div className="alert alert-info" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            ✓ Admission code auto-filled from your activation email.
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleClaim}>
          <div className="form-group">
            <label className="form-label" htmlFor="admissionCode">Admission Code</label>
            <input 
              id="admissionCode"
              type="text" 
              className="form-input" 
              value={admissionCode} 
              onChange={e => setAdmissionCode(e.target.value)} 
              placeholder="e.g. A-12345678"
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label" htmlFor="password">Create Password</label>
            <input 
              id="password"
              type="password" 
              className="form-input" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              placeholder="Must be at least 8 characters"
              minLength={8}
              required 
            />

            {/* Password Requirements Live Checklist */}
            <div style={{ marginTop: '0.75rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
                Password Requirements:
              </span>
              {PASSWORD_REQUIREMENTS.map((req) => {
                const isMet = req.test(password);
                return (
                  <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: isMet ? '#16a34a' : '#64748b', fontWeight: isMet ? 600 : 400, transition: 'all 0.2s ease' }}>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: isMet ? '#dcfce7' : '#e2e8f0', border: `1px solid ${isMet ? '#86efac' : '#cbd5e1'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {isMet ? <Check size={10} color="#16a34a" strokeWidth={3} /> : <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#94a3b8' }} />}
                    </div>
                    <span>{req.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <button 
            type="submit" 
            className="btn btn-navy" 
            style={{ width: '100%', padding: '0.875rem' }}
            disabled={loading}
          >
            {loading ? 'Activating Account...' : 'Activate Account'}
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}
