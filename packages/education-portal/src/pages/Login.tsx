import { useState } from 'react';
import { Link, useNavigate } from '../shims/react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { API_WORKER_URL } from '../lib/contracts-bridge';
import styles from './Login.module.css';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';

// SSO buttons: in dev, use relative paths so the browser navigates through the
// Vite proxy (same origin = cookies work). In production, use full API URL.
const SSO_BASE = '/api';

export default function Login() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [error, setError] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresMfa, setRequiresMfa] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tempLoginData, setTempLoginData] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (requiresMfa && tempLoginData) {
        const res = await api.auth.login(tempLoginData.email, tempLoginData.password, mfaToken);
        setUser(res.user!);
        const dest = res.user?.role === 'admin' || res.user?.role === 'staff' ? '/admin' : res.user?.role === 'student' ? '/student/dashboard' : '/status';
        navigate(dest);
      } else {
        const res = await api.auth.login(email, password);
        if (res.requires_mfa) {
          setTempLoginData({ email, password });
          setRequiresMfa(true);
        } else {
          setUser(res.user ?? null);
          const dest = res.user?.role === 'admin' || res.user?.role === 'staff' ? '/admin' : res.user?.role === 'student' ? '/student/dashboard' : '/status';
          navigate(dest);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Login failed.';
      if (msg.includes('verify your email')) {
        setError(msg);
        setShowResend(true);
      } else {
        setShowResend(false);
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      
      {/* Removed Left Panel as it conflicts with global Navbar */}


      {/* Right Login Panel */}
      <div className={styles.rightPanel}>
        <div className={styles.formWrapper}>
          
          <div className={styles.header}>

            <h1>Welcome Back</h1>
            <p>{requiresMfa ? 'Enter your two-factor authentication code' : 'Sign in to your account'}</p>
          </div>

          {error && (
            <div className={styles.errorAlert}>
              <span>{error}</span>
              {showResend && (
                <Link to="/register">Resend verification email</Link>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!requiresMfa ? (
              <>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    autoFocus
                    className={styles.input}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label className={styles.label}>Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={styles.input}
                  />
                  <Link to="/forgot-password" className={styles.forgotPassword}>
                    Forgot Password?
                  </Link>
                </div>
              </>
            ) : (
              <div className={styles.formGroup}>
                <label className={styles.label}>6-Digit Code</label>
                <input
                  type="text"
                  required
                  value={mfaToken}
                  onChange={e => setMfaToken(e.target.value)}
                  placeholder="123456"
                  maxLength={6}
                  autoFocus
                  className={styles.input}
                />
              </div>
            )}

            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? <div className={styles.spinner} /> : (requiresMfa ? 'Verify Code →' : 'Sign In →')}
            </button>
            
            {requiresMfa && (
              <button 
                type="button" 
                className={styles.backBtn}
                onClick={() => { setRequiresMfa(false); setTempLoginData(null); setMfaToken(''); }}
              >
                Back
              </button>
            )}
          </form>

          {!requiresMfa && (
            <>
              <div className={styles.divider}>
                <span>or continue with</span>
              </div>

              <div className={styles.ssoButtons}>
                <button
                  type="button"
                  onClick={() => { window.location.href = `${SSO_BASE}/auth/oauth/google`; }}
                  className={styles.ssoBtn}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.014 24.014 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => { window.location.href = `${SSO_BASE}/auth/oauth/microsoft`; }}
                  className={styles.ssoBtn}
                >
                  <svg width="18" height="18" viewBox="0 0 21 21"><rect x="1" y="1" width="9" height="9" fill="#F25022"/><rect x="11" y="1" width="9" height="9" fill="#7FBA00"/><rect x="1" y="11" width="9" height="9" fill="#00A4EF"/><rect x="11" y="11" width="9" height="9" fill="#FFB900"/></svg>
                  Microsoft
                </button>
              </div>

              <div className={styles.footer}>
                Don't have an account? <Link to="/register">Apply Now</Link>
              </div>
            </>
          )}
          
        </div>
      </div>
      
    </div>
  );
}
