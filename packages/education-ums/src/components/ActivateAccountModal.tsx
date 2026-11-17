import React, { useState } from 'react';
import { Mail, ArrowLeft, Loader2, CheckCircle, AlertCircle, KeyRound } from '../shims/lucide-react';
import { requestPasswordReset } from '../services/authService';

interface ActivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ActivateAccountModal: React.FC<ActivateAccountModalProps> = ({ 
  isOpen, 
  onClose
}) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // We use the same backend endpoint for activation as password reset
    const result = await requestPasswordReset(email);

    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error || 'Failed to send activation email. Please check the email address or contact IT.');
    }

    setLoading(false);
  };

  const handleClose = () => {
    setEmail('');
    setSuccess(false);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4B0082] to-[#6A0DAD] px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <KeyRound size={20} className="text-[#FFD700]" />
              Activate Account
            </h2>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-emerald-50">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-[#2E004F] mb-2 uppercase tracking-tight">Activation Link Sent</h3>
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                If an admitted student account exists with <strong>{email}</strong>, we've sent an activation link to that address. Please check your inbox to set your initial password.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-3.5 px-4 bg-[#4B0082] text-white rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-black transition-colors"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-[#4B0082] text-sm font-medium">
                  Welcome to BMI University! Enter the personal email address you provided during admission to activate your account and set your password.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start space-x-3 mb-4">
                  <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-[#4B0082] uppercase tracking-widest ml-1">
                    Student Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent text-gray-700 text-sm transition-all"
                      placeholder="Enter your email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-black uppercase tracking-widest text-[#4B0082] bg-[#FFD700] hover:brightness-105 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Activation Link'
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full flex justify-center items-center py-3 px-4 text-xs font-bold text-gray-500 hover:text-[#4B0082] transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivateAccountModal;
