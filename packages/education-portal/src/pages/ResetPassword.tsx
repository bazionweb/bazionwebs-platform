import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from '../shims/react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
  ArrowLeft,
  Check,
  X,
} from '../shims/lucide-react';
import { api } from '../lib/api';
import styles from './ResetPassword.module.css';

type StrengthResult = {
  score: number;
  label: string;
  color: string;
};

function getPasswordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Very Weak', color: '#ef4444' };
  if (score === 2) return { score, label: 'Weak', color: '#f97316' };
  if (score === 3) return { score, label: 'Fair', color: '#eab308' };
  if (score === 4) return { score, label: 'Strong', color: '#22c55e' };
  return { score, label: 'Very Strong', color: '#16a34a' };
}

type Requirement = {
  label: string;
  met: boolean;
};

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/login', { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, navigate]);

  const requirements: Requirement[] = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'One uppercase letter (A–Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'One number (0–9)', met: /[0-9]/.test(newPassword) },
    { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const allRequirementsMet = requirements.every((r) => r.met);
  const canSubmit = !loading && passwordsMatch && allRequirementsMet && !!token;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.auth.resetPassword(token!, newPassword);
      setSuccessMsg(res.message || 'Password reset successful.');
      setSuccess(true);
    } catch (err: any) {
      const raw = err?.message || 'Something went wrong. Please try again.';
      if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        if (lower.includes('invalid') || lower.includes('expired') || lower.includes('already used')) {
          setError('This reset link has expired or already been used. Please request a new one.');
        } else if (lower.includes('match')) {
          setError(raw);
        } else {
          setError(raw);
        }
      } else {
        setError('Password reset failed. Please request a new link.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className={styles.resetPage}>
        <div className={styles.card}>
          <div className={styles.topAccent} />
          <div className={styles.header}>
            <div className={`${styles.iconBadge} ${styles.iconBadgeError}`}>
              <AlertCircle size={28} strokeWidth={2.25} />
            </div>
            <h1 className={styles.title}>Invalid Reset Link</h1>
            <p className={styles.subtitle}>
              This password reset link is missing a token or has already been used.
              Please request a new one to continue.
            </p>
          </div>

          <Link to="/forgot-password" className={styles.loginBtn}>
            <ArrowLeft size={18} />
            Request New Reset Link
          </Link>

          <div className={styles.brandFooter}>
            <span className={styles.brandText}>BMI University Portal © 2024</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.resetPage}>
      <div className={styles.card}>
        <div className={styles.topAccent} />

        {success ? (
          <div className={styles.successSection}>
            <div className={`${styles.iconBadge} ${styles.iconBadgeSuccess}`}>
              <CheckCircle size={36} strokeWidth={2.5} />
            </div>
            <h1 className={styles.successTitle}>Password Updated!</h1>
            <p className={styles.successSubtitle}>
              {successMsg ||
                'Your password has been successfully changed. You can now log in with your new password.'}
            </p>

            <div className={styles.countdownBox}>
              <span className={styles.countdownText}>Redirecting to login in</span>
              <span className={styles.countdownNum}>{countdown}</span>
              <span className={styles.countdownText}>seconds…</span>
            </div>

            <Link to="/login" className={styles.loginBtn}>
              Go to Login Now
              <ArrowLeft size={18} style={{ transform: 'rotate(180deg)' }} />
            </Link>
          </div>
        ) : (
          <>
            <div className={styles.header}>
              <div className={styles.iconBadge}>
                <ShieldCheck size={28} strokeWidth={2.25} />
              </div>
              <h1 className={styles.title}>Set New Password</h1>
              <p className={styles.subtitle}>
                Choose a strong, unique password to secure your BMI University student account.
              </p>
            </div>

            {error && (
              <div className={`${styles.alert} ${styles.alertError}`}>
                <AlertCircle className={styles.alertIcon} size={18} />
                <div className={styles.alertContent}>
                  <div className={styles.alertTitle}>Reset Failed</div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              <div className={styles.field}>
                <label htmlFor="new-password" className={styles.label}>
                  New Password
                </label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={18} />
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    aria-describedby="strength-label reqs-group"
                    className={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className={styles.toggleBtn}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {newPassword.length > 0 && (
                  <div className={styles.strengthSection} id="strength-label">
                    <div className={styles.strengthBar} aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={styles.strengthSegment}
                          style={{
                            backgroundColor: i <= strength.score ? strength.color : undefined,
                          }}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel} style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.field}>
                <label htmlFor="confirm-password" className={styles.label}>
                  Confirm Password
                </label>
                <div className={styles.inputWrapper}>
                  <Lock className={styles.inputIcon} size={18} />
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    aria-invalid={confirmPassword.length > 0 && !passwordsMatch}
                    className={`${styles.input} ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? styles.inputMatch
                          : styles.inputMismatch
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className={styles.toggleBtn}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    tabIndex={0}
                  >
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <div className={styles.matchHint} style={{ color: passwordsMatch ? '#16a34a' : '#dc2626' }}>
                    {passwordsMatch ? (
                      <>
                        <Check size={14} strokeWidth={3} />
                        <span>Passwords match</span>
                      </>
                    ) : (
                      <>
                        <X size={14} strokeWidth={3} />
                        <span>Passwords do not match</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.requirements} id="reqs-group">
                <div className={styles.requirementsTitle}>Password Requirements</div>
                <ul className={styles.requirementsList}>
                  {requirements.map((req) => (
                    <li
                      key={req.label}
                      className={`${styles.requirementItem} ${
                        req.met ? styles.requirementItemMet : ''
                      }`}
                    >
                      <span
                        className={`${styles.checkDot} ${req.met ? styles.checkDotMet : ''}`}
                      >
                        {req.met ? <Check size={10} color="white" strokeWidth={4} /> : null}
                      </span>
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button type="submit" disabled={!canSubmit} className={styles.submitBtn}>
                {loading ? (
                  <>
                    <Loader2 className={styles.spinner} />
                    Updating Password…
                  </>
                ) : (
                  <>Reset Password</>
                )}
              </button>
            </form>

            <div className={styles.footer}>
              <Link to="/login" className={styles.footerLink}>
                <ArrowLeft size={15} />
                Back to Login
              </Link>
            </div>

            <div className={styles.brandFooter}>
              <span className={styles.brandText}>BMI University Portal © 2024</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
