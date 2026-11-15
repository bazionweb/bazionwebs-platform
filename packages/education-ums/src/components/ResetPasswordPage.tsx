import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from '../shims/react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ShieldCheck } from '../shims/lucide-react';
import { resetPassword } from '../services/authService';

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
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

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  const strength = getPasswordStrength(password);
  const passwordsMatch = password === passwordConfirm && passwordConfirm.length > 0;

  // Countdown redirect after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/', { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [success, countdown, navigate]);

  // No token in URL — show an error immediately
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a0033] via-[#4B0082] to-[#320064] flex items-center justify-center p-4">
        <div className="bg-white/95 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Reset Link</h1>
          <p className="text-gray-500 text-sm mb-6">
            This password reset link is missing a token or has already been used. Please request a new one.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full py-3 px-4 bg-gradient-to-r from-[#FFD700] to-[#FDB931] text-[#4B0082] font-bold rounded-xl hover:brightness-105 transition-all"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== passwordConfirm) {
      setError('Passwords do not match. Please check and try again.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    const result = await resetPassword(token, password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      const raw = result.error;
      if (typeof raw === 'string') {
        if (raw.toLowerCase().includes('invalid') || raw.toLowerCase().includes('expired')) {
          setError('This reset link has expired or already been used. Please request a new one.');
        } else {
          setError(raw);
        }
      } else {
        setError('Password reset failed. Please request a new link.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a0033] via-[#4B0082] to-[#320064] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-[#FFD700] rounded-full mix-blend-overlay blur-[120px] opacity-20 animate-pulse" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] bg-[#6A0DAD] rounded-full mix-blend-overlay blur-[100px] opacity-40" />
      </div>

      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-[440px] p-8 md:p-10 relative z-10 border border-white/20">
        {/* Top accent */}
        <div className="absolute top-0 left-0 w-full h-2 rounded-t-2xl bg-gradient-to-r from-[#4B0082] via-[#FFD700] to-[#4B0082]" />

        {success ? (
          /* ── Success State ── */
          <div className="text-center py-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 shadow-inner">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated!</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your password has been successfully changed. You can now log in with your new password.
            </p>
            <div className="bg-[#4B0082]/10 rounded-xl py-3 px-4 mb-6">
              <p className="text-[#4B0082] text-sm font-medium">
                Redirecting to login in <span className="font-bold text-lg">{countdown}</span>s…
              </p>
            </div>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFD700] to-[#FDB931] text-[#4B0082] font-bold rounded-xl hover:brightness-105 transition-all shadow-lg"
            >
              Go to Login Now
            </button>
          </div>
        ) : (
          /* ── Form State ── */
          <>
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-[#4B0082]/10 rounded-2xl flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 text-[#4B0082]" />
              </div>
              <h1 className="text-2xl font-bold text-[#4B0082] text-center">Set New Password</h1>
              <p className="text-gray-500 text-sm mt-2 text-center">
                Choose a strong password to secure your BMI University account.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 mb-5">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Reset Failed</p>
                  <p className="text-xs text-red-600 mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#4B0082] uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#FFD700] transition-colors" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-gray-700 text-sm transition-all shadow-inner"
                    placeholder="Minimum 8 characters"
                    required
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#4B0082] transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="flex-1 h-1.5 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: i <= strength.score ? strength.color : '#e5e7eb',
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-medium" style={{ color: strength.color }}>
                      {strength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#4B0082] uppercase tracking-wider">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-[#FFD700] transition-colors" />
                  </div>
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className={`block w-full pl-10 pr-10 py-3 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-gray-700 text-sm transition-all shadow-inner ${
                      passwordConfirm.length > 0
                        ? passwordsMatch
                          ? 'border-green-400'
                          : 'border-red-300'
                        : 'border-gray-200'
                    }`}
                    placeholder="Re-enter your new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-[#4B0082] transition-colors"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordConfirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> Passwords match
                  </p>
                )}
              </div>

              {/* Password requirements hint */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Requirements</p>
                {[
                  { label: 'At least 8 characters', met: password.length >= 8 },
                  { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(password) },
                  { label: 'One number (0-9)', met: /[0-9]/.test(password) },
                  { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
                ].map((req) => (
                  <div key={req.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${req.met ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <p className={`text-xs ${req.met ? 'text-green-700' : 'text-gray-500'}`}>{req.label}</p>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading || !passwordsMatch || password.length < 8}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg text-sm font-bold text-[#4B0082] bg-gradient-to-r from-[#FFD700] to-[#FDB931] hover:brightness-105 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFD700] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating Password…
                  </>
                ) : (
                  'Set New Password'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <span className="text-[10px] text-gray-400 uppercase tracking-widest">
                Powered by BMI Systems © 2024
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
