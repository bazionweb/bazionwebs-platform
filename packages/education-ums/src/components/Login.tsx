import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, AlertCircle, Loader2 } from '../shims/lucide-react';
import { User, AuthResponse } from '../services/authService';
import { API_URL } from '../services/config';
import { bemiTrainingInstituteTenantConfig, bmiUniversityTenantConfig, isBemiHost } from '@bazion/education-contracts';
import { useAuthStore } from '../stores/authStore';
import ForgotPasswordModal from './ForgotPasswordModal';
import ActivateAccountModal from './ActivateAccountModal';
import MfaModal from './MfaModal';

interface LoginProps {
  onLogin: (token: string, user: User) => void;
  logo?: string;
}

const Login: React.FC<LoginProps> = ({ onLogin, logo }) => {
  const institution = typeof window !== 'undefined' && isBemiHost(window.location.hostname)
    ? bemiTrainingInstituteTenantConfig
    : bmiUniversityTenantConfig;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showActivateAccount, setShowActivateAccount] = useState(false);
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the password field on mount so user only needs to type password
  useEffect(() => {
    const timer = setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  // MFA state
  const [showMfa, setShowMfa] = useState(false);
  const [mfaData] = useState<{
    mfaToken: string;
    setupRequired: boolean;
  } | null>(null);

  const performLogin = async (targetEmail: string, targetPass: string) => {
    setLoading(true);
    setError('');

    const result = await useAuthStore.getState().login(targetEmail, targetPass, rememberMe);

    if (!result.success) {
      let errorMsg = result.error || 'Login failed';
      if (typeof errorMsg === 'string' && (errorMsg.includes('Network error') || errorMsg.includes('Failed to fetch'))) {
        const hint = API_URL.startsWith('/')
          ? 'If you are running locally, the API must be running: start it with `npm run dev` in apps/api (it serves on http://127.0.0.1:8787), then sign in again.'
          : 'The API is not reachable from the browser. Check your network connection.';
        setError(`Unable to reach the authentication server (${API_URL}). ${hint}`);
      } else {
        setError(errorMsg);
      }
    }
    setLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0015] via-[#1e0836] to-[#2d004d] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Decorative Lighting */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute -top-[15%] -left-[10%] w-[55%] h-[55%] bg-[#FFD700] rounded-full mix-blend-screen blur-[140px] opacity-15 animate-pulse"></div>
        <div className="absolute top-[50%] -right-[10%] w-[45%] h-[45%] bg-[#7c3aed] rounded-full mix-blend-screen blur-[120px] opacity-30"></div>
      </div>

      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-[560px] p-6 md:p-8 relative z-10 border border-white/20 dark:border-gray-800 transition-all">
        {/* Header Accent Pill */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-[#4B0082] via-[#FFD700] to-[#4B0082] h-1.5 w-36 rounded-full shadow-md"></div>

        {/* Header / Logo */}
        <div className="flex flex-col items-center mb-5">
          <div className="w-16 h-16 mb-2 relative drop-shadow-xl flex items-center justify-center">
            <img
              src={logo || institution.branding.logoUrl || "/BMI.svg"}
              alt={`${institution.shortName} Logo`}
              className="w-full h-full object-contain rounded-2xl border-2 border-[#FFD700]/80 bg-white p-1"
            />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight text-center">{institution.institutionName}</h1>
          <p className="text-[11px] font-bold text-[#6b21a8] dark:text-[#FFD700] uppercase tracking-wider mt-0.5">Institution management sign in</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl p-3 flex items-start space-x-2.5 mb-5">
            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-xs">
              <p className="font-bold text-red-800 dark:text-red-200">Notice</p>
              <p className="text-red-600 dark:text-red-300 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <div className="flex items-center justify-between mb-1 ml-1">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Institutional Email
              </label>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-gray-400 group-focus-within:text-[#6b21a8] dark:group-focus-within:text-[#FFD700] transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b21a8] dark:focus:ring-[#FFD700] text-gray-900 dark:text-white text-sm font-semibold font-mono transition-all shadow-sm"
              placeholder="staff@institution.example"
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 ml-1">
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Password
              </label>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Enter password to sign in</span>
            </div>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400 group-focus-within:text-[#6b21a8] dark:group-focus-within:text-[#FFD700] transition-colors" />
              </div>
              <input
                ref={passwordInputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b21a8] dark:focus:ring-[#FFD700] text-gray-900 dark:text-white text-sm transition-all shadow-sm"
                placeholder="Enter password..."
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <label className="flex items-center text-gray-600 dark:text-gray-400 cursor-pointer">
              <input 
                type="checkbox" 
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-3.5 w-3.5 text-[#6b21a8] focus:ring-[#FFD700] border-gray-300 rounded cursor-pointer" 
              />
              <span className="ml-2 font-medium">Keep me signed in</span>
            </label>
            <button 
              type="button"
              onClick={() => setShowForgotPassword(true)}
              className="font-bold text-[#6b21a8] dark:text-[#FFD700] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-black text-[#2e004f] bg-gradient-to-r from-[#FFD700] to-[#f59e0b] hover:from-[#ffe033] hover:to-[#fbbf24] active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Credential Reference Footer */}
        <div className="mt-5 pt-3 border-t border-gray-100 dark:border-gray-800 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">BMI University Management System • Controlled Executive Access © 2026</p>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        initialEmail={email}
      />

      <ActivateAccountModal
        isOpen={showActivateAccount}
        onClose={() => setShowActivateAccount(false)}
      />

      {mfaData && (
        <MfaModal
          isOpen={showMfa}
          onClose={() => setShowMfa(false)}
          mfaToken={mfaData.mfaToken}
          setupRequired={mfaData.setupRequired}
          onSuccess={(result: AuthResponse) => {
            if (result.success && result.data) {
              onLogin(result.data.token || '', result.data.user);
            }
          }}
        />
      )}
    </div>
  );
};

export default Login;
