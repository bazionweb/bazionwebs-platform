import React, { useState, useRef, useEffect } from 'react';
import { Mail, Lock, AlertCircle, Loader2, ShieldCheck, UserCheck, KeyRound, Scroll, CreditCard, Users, ClipboardList, BookOpen, Building2, CheckCircle2 } from '../shims/lucide-react';
import { User, AuthResponse } from '../services/authService';
import { API_URL } from '../services/config';
import { useAuthStore } from '../stores/authStore';
import ForgotPasswordModal from './ForgotPasswordModal';
import ActivateAccountModal from './ActivateAccountModal';
import MfaModal from './MfaModal';

interface LoginProps {
  onLogin: (token: string, user: User) => void;
  logo?: string;
}

export const INSTITUTIONAL_ROLES = [
  {
    role: 'Executive Admin',
    emailHint: 'admin@bmiuniversities.org',
    icon: ShieldCheck,
    scope: 'Full Executive & System Access',
    color: 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700 hover:bg-amber-500/20',
    badge: 'Super Admin',
  },
  {
    role: 'Academic Registrar',
    emailHint: 'registrar@bmiuniversities.org',
    icon: Scroll,
    scope: 'Programs, Records & Transcripts',
    color: 'bg-purple-500/10 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-500/20',
    badge: 'Registry',
  },
  {
    role: 'Finance Bursar',
    emailHint: 'finance@bmiuniversities.org',
    icon: CreditCard,
    scope: 'Student Ledgers, Fees & Payroll',
    color: 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-500/20',
    badge: 'Treasury',
  },
  {
    role: 'Faculty Dean & Chair',
    emailHint: 'faculty@bmiuniversities.org',
    icon: UserCheck,
    scope: 'Classes, Grading & Timetables',
    color: 'bg-indigo-500/10 text-indigo-900 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-500/20',
    badge: 'Academics',
  },
  {
    role: 'Admissions Officer',
    emailHint: 'admissions@bmiuniversities.org',
    icon: ClipboardList,
    scope: 'Applications, Vetting & Intakes',
    color: 'bg-cyan-500/10 text-cyan-900 dark:text-cyan-300 border-cyan-300 dark:border-cyan-700 hover:bg-cyan-500/20',
    badge: 'Admissions',
  },
  {
    role: 'HR Director',
    emailHint: 'hr@bmiuniversities.org',
    icon: Users,
    scope: 'Staff Directory, Leaves & HR',
    color: 'bg-rose-500/10 text-rose-900 dark:text-rose-300 border-rose-300 dark:border-rose-700 hover:bg-rose-500/20',
    badge: 'HR & Personnel',
  },
  {
    role: 'Chief Librarian',
    emailHint: 'library@bmiuniversities.org',
    icon: BookOpen,
    scope: 'Catalogs, Loans & Digital Repos',
    color: 'bg-teal-500/10 text-teal-900 dark:text-teal-300 border-teal-300 dark:border-teal-700 hover:bg-teal-500/20',
    badge: 'Library',
  },
  {
    role: 'Campus Facilities',
    emailHint: 'facilities@bmiuniversities.org',
    icon: Building2,
    scope: 'Hostels, Health & Campus Assets',
    color: 'bg-orange-500/10 text-orange-900 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-500/20',
    badge: 'Operations',
  },
];

const Login: React.FC<LoginProps> = ({ onLogin, logo }) => {
  // Pre-load default institutional executive role and email
  const [email, setEmail] = useState('admin@bmiuniversities.org');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showActivateAccount, setShowActivateAccount] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('Executive Admin');
  
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

  /**
   * Selecting a role instantly populates that role's official institutional email
   * and shifts focus directly to the password field.
   */
  const handleRoleSelect = (roleName: string, emailHint: string) => {
    setSelectedRole(roleName);
    setEmail(emailHint);
    setError('');
    // Instantly focus password input so user only types password
    setTimeout(() => {
      passwordInputRef.current?.focus();
    }, 50);
  };

  const activeRoleObj = INSTITUTIONAL_ROLES.find(r => r.role === selectedRole);

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
              src={logo || "/BMI.svg"}
              alt="BMI University Logo"
              className="w-full h-full object-contain rounded-2xl border-2 border-[#FFD700]/80 bg-white p-1"
            />
          </div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight text-center">BMI University</h1>
          <p className="text-[11px] font-bold text-[#6b21a8] dark:text-[#FFD700] uppercase tracking-wider mt-0.5">Administrative & Executive Console</p>
        </div>

        {/* Controlled Role Directory */}
        <div className="mb-5 bg-slate-50 dark:bg-gray-800/60 rounded-2xl p-3 border border-slate-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-extrabold text-gray-700 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5 text-[#FFD700]" />
              Controlled Executive Roles
            </span>
            <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">Click to Switch Role</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {INSTITUTIONAL_ROLES.map((roleItem) => {
              const Icon = roleItem.icon;
              const isSelected = selectedRole === roleItem.role || email.toLowerCase() === roleItem.emailHint.toLowerCase();
              return (
                <button
                  key={roleItem.role}
                  type="button"
                  onClick={() => handleRoleSelect(roleItem.role, roleItem.emailHint)}
                  disabled={loading}
                  aria-pressed={isSelected}
                  title={`${roleItem.role} (${roleItem.emailHint})`}
                  className={`flex flex-col items-start p-2 rounded-xl border transition-all ${
                    isSelected
                      ? roleItem.color + ' ring-2 ring-[#6b21a8] dark:ring-[#FFD700] ring-offset-1 scale-[1.02] shadow-sm font-bold'
                      : roleItem.color + ' opacity-75 hover:opacity-100 hover:scale-[1.01]'
                  } text-left cursor-pointer active:scale-95 disabled:opacity-50 group`}
                >
                  <div className="flex items-center gap-1 w-full mb-0.5">
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="text-[10px] font-extrabold leading-tight truncate">{roleItem.role.split(' ')[0]} {roleItem.role.split(' ')[1] || ''}</span>
                  </div>
                  <span className="text-[9px] font-mono opacity-80 leading-tight truncate w-full">{roleItem.emailHint}</span>
                </button>
              );
            })}
          </div>
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
              {activeRoleObj && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  {activeRoleObj.role}
                </span>
              )}
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
                  const matched = INSTITUTIONAL_ROLES.find(r => r.emailHint.toLowerCase() === e.target.value.toLowerCase());
                  setSelectedRole(matched ? matched.role : '');
                }}
                className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#6b21a8] dark:focus:ring-[#FFD700] text-gray-900 dark:text-white text-sm font-semibold font-mono transition-all shadow-sm"
                placeholder="admin@bmiuniversities.org"
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
              `Sign In as ${selectedRole || 'User'}`
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
