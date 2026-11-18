import React, { useState } from 'react';
import { useNavigate } from '../../shims/react-router-dom';
import { Lock, User, AlertCircle, ArrowRight, Shield } from '../../shims/lucide-react';
import { portalAuthService } from '../services/portalAuth';
import '../portal.css';

const PortalLogin: React.FC = () => {
  const [membershipNumber, setMembershipNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      await portalAuthService.loginWithPassword(membershipNumber, password);
      navigate('/portal/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in. Check your details and try again.');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

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
            <p className="portal-subtitle">Member Portal</p>
            <p className="portal-hint">Sign in with the password for the account linked to your membership record.</p>
          </div>

          <div className="portal-body">
            {error && (
              <div className="portal-alert portal-alert-error">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="portal-form">
              <div className="portal-field">
                <label htmlFor="membership-number" className="portal-label">Membership Number</label>
                <div className="portal-input-wrap">
                  <User size={16} className="portal-input-icon" />
                  <input
                    id="membership-number"
                    type="text"
                    required
                    autoComplete="username"
                    placeholder="e.g. HKM-004"
                    className="portal-input"
                    value={membershipNumber}
                    onChange={(event) => setMembershipNumber(event.target.value)}
                  />
                </div>
              </div>

              <div className="portal-field">
                <label htmlFor="login-password" className="portal-label">Password</label>
                <div className="portal-input-wrap">
                  <Lock size={16} className="portal-input-icon" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    className="portal-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="portal-submit-btn">
                {loading ? <span className="portal-spinner" /> : <><Shield size={16} />Sign In</>}
              </button>
            </form>

            <p className="portal-note">Access is restricted to active HKM members with a linked account. Contact the church office if your account is not linked or you need a password reset.</p>
          </div>

          <div className="portal-footer">
            <a href="https://hkmministries.org" className="portal-back-link">
              <ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} />
              Back to HKM Ministries Website
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalLogin;
