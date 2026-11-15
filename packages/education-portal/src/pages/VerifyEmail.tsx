import { useState, useEffect } from 'react';
import { Link, useSearchParams } from '../shims/react-router-dom';
import { api } from '../lib/api';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please use the link from your email.');
      return;
    }
    api.auth.verifyEmail(token)
      .then(res => {
        setStatus('success');
        setMessage(res.message);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Verification failed');
      });
  }, [params]);

  return (
    <div className="page-center" style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)' }}>
      <div style={{ width: '100%', maxWidth: 440, textAlign: 'center' }}>
        <div className="card">
          {status === 'verifying' && (
            <div>
              <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto 1rem' }} />
              <h2>Verifying your email...</h2>
            </div>
          )}
          {status === 'success' && (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
              <h2 style={{ marginBottom: '0.5rem' }}>Email Verified!</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{message}</p>
              <Link to="/login" className="btn btn-gold">Sign In to Your Account</Link>
            </div>
          )}
          {status === 'error' && (
            <div>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
              <h2 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Verification Failed</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>{message}</p>
              <Link to="/login" className="btn btn-outline">Back to Login</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
