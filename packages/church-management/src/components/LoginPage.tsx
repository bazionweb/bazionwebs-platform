import React, { useState } from 'react';
import {
  MailIcon,
  LockIcon,
  ArrowRightIcon,
  ExclamationIcon,
  EyeIcon,
  EyeOffIcon,
  CheckCircleIcon,
  UserPlusIcon,
  ArrowLeftIcon,
  CameraIcon,
  UserIcon,
} from './Icons';
import { User as AppUser } from './userData';
import { useTheme } from './ThemeContext';
import EnterpriseRegistration, { RegistrationData, RegistrationResult } from './EnterpriseRegistration';

export interface LoginResult {
  success: boolean;
  reason?: 'unverified' | 'error' | 'password-expired';
  message?: string;
  user?: AppUser;
}

interface LoginPageProps {
  onLogin: (email: string, password: string) => Promise<LoginResult>;
  onRegister: (email: string, password: string, avatar?: string) => Promise<LoginResult>;
  onEnterpriseRegister: (data: RegistrationData) => Promise<RegistrationResult>;
  onResetPassword: (email: string) => Promise<boolean>;
  onGoogleLogin?: (email: string, displayName: string, photoURL: string) => Promise<LoginResult>;
  onChangePassword: (userId: string, newPassword: string) => Promise<boolean>;
  onResendVerification?: (email: string) => Promise<boolean>;
}

const LoginPage: React.FC<LoginPageProps> = ({
  onLogin,
  onRegister,
  onEnterpriseRegister,
  onResetPassword,
  onGoogleLogin,
  onChangePassword,
  onResendVerification,
}) => {
  const { colors } = useTheme();
  const [viewState, setViewState] = useState<
    'login' | 'register' | 'enterprise-register' | 'reset' | 'change-password'
  >('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [user, setUser] = useState<AppUser | null>(null);
  const [avatar, setAvatar] = useState<string>('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      if (viewState === 'reset') {
        const success = await onResetPassword(email);
        if (success) {
          setSuccessMessage(`Password reset simulated for ${email}. Check your email.`);
        } else {
          setError('Failed to reset password.');
        }
      } else {
        if (viewState === 'login') {
          const result = await onLogin(email, password);
          if (result.success) {
            // Handled by App.tsx
          } else if (result.reason === 'password-expired') {
            setUser(result.user!);
            setViewState('change-password');
            setError(result.message || 'Password expired.');
          } else {
            setError(result.message || 'Login failed.');
          }
        } else if (viewState === 'change-password') {
          if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
          }
          if (user) {
            const success = await onChangePassword(user.id, newPassword);
            if (success) {
              setSuccessMessage('Password changed successfully. Please log in again.');
              setViewState('login');
              setPassword('');
              setNewPassword('');
              setConfirmPassword('');
            } else {
              setError('Failed to change password.');
            }
          }
        } else {
          // Register
          const result = await onRegister(email, password, avatar);
          if (result.success) {
            setSuccessMessage('Registration successful! Please log in.');
            setViewState('login');
          } else {
            setError(result.message || 'Registration failed.');
          }
        }
      }
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const getTitle = () => {
    switch (viewState) {
      case 'register':
        return 'Create a new account';
      case 'enterprise-register':
        return 'Enterprise Registration';
      case 'reset':
        return 'Reset your password';
      default:
        return 'Login to your account';
    }
  };

  // Show enterprise registration if selected
  if (viewState === 'enterprise-register') {
    return (
      <EnterpriseRegistration
        onRegister={onEnterpriseRegister}
        onBack={() => setViewState('login')}
        onResendVerification={onResendVerification}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="inline-block mb-4">
              <img
                src="/hkm-logo.webp"
                alt="Heavenly God Kingdom Churches Logo"
                className="h-20 w-auto mx-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">HKM MINISTRIES</h1>
            <p className="text-gray-500">{getTitle()}</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative text-sm"
                role="alert"
              >
                <strong className="font-bold block mb-1">
                  <ExclamationIcon className="inline w-4 h-4 mr-1" /> Error
                </strong>
                <span className="block">{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative text-sm flex items-start">
                <CheckCircleIcon className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {viewState === 'register' && (
              <div className="flex flex-col items-center mb-4">
                <div className="relative">
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Avatar Preview"
                      className="w-24 h-24 rounded-full object-cover border-4 border-gray-100 shadow-sm"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <UserIcon className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full cursor-pointer shadow-md transition-colors"
                  >
                    <CameraIcon className="w-4 h-4" />
                  </label>
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">Upload Profile Photo (Optional)</p>
              </div>
            )}

            {viewState === 'change-password' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="new-password">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <LockIcon className="h-5 w-5 text-gray-400" />
                    </span>
                    <input
                      id="new-password"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="confirm-password">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <LockIcon className="h-5 w-5 text-gray-400" />
                    </span>
                    <input
                      id="confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="••••••••"
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="email">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                      <MailIcon className="h-5 w-5 text-gray-400" />
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                {viewState !== 'reset' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1" htmlFor="password">
                      Password
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <LockIcon className="h-5 w-5 text-gray-400" />
                      </span>
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                      </button>
                    </div>
                    {viewState === 'register' && (
                      <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                    )}
                  </div>
                )}
              </>
            )}

            {viewState === 'login' && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setViewState('reset');
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="text-sm text-green-600 hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full ${colors.primary} ${colors.primaryHover} text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading
                ? viewState === 'login'
                  ? 'Signing in...'
                  : viewState === 'register'
                    ? 'Registering...'
                    : viewState === 'change-password'
                      ? 'Changing Password...'
                      : 'Sending...'
                : viewState === 'login'
                  ? 'Sign in'
                  : viewState === 'register'
                    ? 'Create Account'
                    : viewState === 'change-password'
                      ? 'Change Password'
                      : 'Send Reset Link'}
              {!isLoading &&
                viewState !== 'reset' &&
                (viewState === 'login' ? (
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                ) : (
                  <UserPlusIcon className="ml-2 h-5 w-5" />
                ))}
            </button>

            {/* Google Sign-In Button */}
            {viewState !== 'reset' && viewState !== 'change-password' && onGoogleLogin && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            {viewState === 'reset' || viewState === 'change-password' ? (
              <button
                onClick={() => {
                  setViewState('login');
                  setError('');
                  setSuccessMessage('');
                }}
                className="flex items-center justify-center w-full text-sm text-gray-600 hover:text-gray-900 font-medium"
              >
                <ArrowLeftIcon className="h-4 w-4 mr-2" /> Back to Login
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {viewState === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => {
                      setViewState(viewState === 'login' ? 'register' : 'login');
                      setError('');
                      setAvatar('');
                    }}
                    className="text-green-600 hover:text-green-800 font-semibold focus:outline-none hover:underline"
                  >
                    {viewState === 'login' ? 'Sign Up' : 'Log In'}
                  </button>
                </p>

                {viewState === 'login' && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-gray-500 mb-2">Need enterprise-grade security?</p>
                    <button
                      onClick={() => setViewState('enterprise-register')}
                      className="text-blue-600 hover:text-blue-800 font-semibold text-sm focus:outline-none hover:underline"
                    >
                      Enterprise Registration →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-sm text-gray-500 mt-8">HKM MINISTRIES</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
