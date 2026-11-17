import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle, Shield, Eye, EyeOff } from 'lucide-react';
import { portalAuthService } from '../services/portalAuth';

const MIN_PASSWORD_LENGTH = 8;

interface Requirement {
  label: string;
  test: (pw: string) => boolean;
}

const REQUIREMENTS: Requirement[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= MIN_PASSWORD_LENGTH },
  { label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { label: 'One number', test: (pw) => /\d/.test(pw) },
  { label: 'One special character (@$!%*?&)', test: (pw) => /[@$!%*?&]/.test(pw) },
];

import '../portal.css';

const SetPassword: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = portalAuthService.getCurrentUser();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // If user doesn't need password setup, redirect to dashboard
    if (!currentUser || !portalAuthService.needsPasswordSetup()) {
      navigate('/portal/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const getPasswordStrength = (): { score: number; label: string; color: string } => {
    const passed = REQUIREMENTS.filter((r) => r.test(password)).length;
    if (passed === 0) return { score: 0, label: '', color: 'transparent' };
    if (passed <= 2) return { score: 1, label: 'Weak', color: '#ef4444' };
    if (passed <= 4) return { score: 2, label: 'Medium', color: '#f59e0b' };
    return { score: 3, label: 'Strong', color: '#10b981' };
  };

  const strength = getPasswordStrength();

  const passwordsMatch = password === confirmPassword;
  const allRequirementsMet = REQUIREMENTS.every((r) => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet || !passwordsMatch || !currentUser) return;

    setLoading(true);
    setError('');

    try {
      await portalAuthService.setPassword(password);
      setSuccess(true);
      setTimeout(() => navigate('/portal/dashboard', { replace: true }), 1500);
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="portal-login-root">
        <div className="portal-bg">
          <div className="portal-bg-overlay" />
          <div className="portal-bg-pattern" />
        </div>
        <div className="portal-card-wrapper">
          <div className="portal-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <CheckCircle size={48} style={{ color: '#10b981', marginBottom: 16 }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
              Password Set Successfully!
            </h2>
            <p style={{ color: '#64748b', marginBottom: 24, fontSize: '0.875rem' }}>
              Your new password is active. Redirecting to dashboard...
            </p>
            <div className="portal-spinner" style={{ margin: '0 auto' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-login-root">
      <div className="portal-bg">
        <div className="portal-bg-overlay" />
        <div className="portal-bg-pattern" />
      </div>

      <div className="portal-card-wrapper">
        <div className="portal-card">
          <div className="portal-header">
            <div className="portal-logo-wrap">
              <img src="/hkm-logo.webp" alt="Heavenly God Kingdom Churches Logo" className="portal-logo" />
            </div>
            <h1 className="portal-church-name">Heavenly God Kingdom Churches</h1>
            <div className="portal-divider" />
            <p className="portal-subtitle">Set Your Password</p>
            <p className="portal-hint">This is your first login. Create a strong password to secure your account.</p>
          </div>

          <div className="portal-body">
            {error && (
              <div className="portal-alert portal-alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="portal-form">
              <div className="portal-info-box">
                <Shield size={16} />
                <span>
                  Logged in as <strong>{currentUser?.membership_number}</strong>
                  {currentUser?.full_name ? ` (${currentUser.full_name})` : ''}
                </span>
              </div>

              <div className="portal-field">
                <label htmlFor="new-password" className="portal-label">
                  New Password
                </label>
                <div className="portal-input-wrap">
                  <Lock size={16} className="portal-input-icon" />
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Enter your new password"
                    className="portal-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="portal-toggle-vis"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="portal-field">
                <label htmlFor="confirm-password" className="portal-label">
                  Confirm Password
                </label>
                <div className="portal-input-wrap">
                  <Lock size={16} className="portal-input-icon" />
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    autoComplete="new-password"
                    placeholder="Confirm your password"
                    className="portal-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {/* Password requirements */}
              <div className="portal-requirements">
                <p className="portal-req-title">Password must contain:</p>
                {REQUIREMENTS.map((req) => {
                  const met = req.test(password);
                  return (
                    <div key={req.label} className={`portal-req-item ${met ? 'met' : ''}`}>
                      {met ? <CheckCircle size={12} /> : <div className="portal-req-dot" />}
                      <span>{req.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Strength indicator */}
              {password.length > 0 && (
                <div className="portal-strength">
                  <div className="portal-strength-bar">
                    <div
                      style={{
                        width: `${(strength.score / 3) * 100}%`,
                        height: '100%',
                        background: strength.color,
                        borderRadius: 999,
                        transition: 'all 0.3s',
                      }}
                    />
                  </div>
                  <span style={{ color: strength.color, fontWeight: 600, fontSize: '0.78rem' }}>{strength.label}</span>
                </div>
              )}

              {/* Confirm mismatch */}
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p style={{ color: '#ef4444', fontSize: '0.78rem', fontWeight: 500, marginTop: -8 }}>
                  Passwords do not match
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !allRequirementsMet || !passwordsMatch}
                className="portal-submit-btn"
              >
                {loading ? (
                  <span className="portal-spinner" />
                ) : (
                  <>
                    <Shield size={16} />
                    Set Password & Continue
                  </>
                )}
              </button>

              <button
                type="button"
                className="portal-cancel-btn"
                onClick={() => {
                  portalAuthService.logout();
                  navigate('/portal/login');
                }}
              >
                ← Logout & Return to Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetPassword;
