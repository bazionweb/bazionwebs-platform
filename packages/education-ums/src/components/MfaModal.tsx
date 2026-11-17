import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, AlertCircle, Loader2, CheckCircle, Copy } from '../shims/lucide-react';
import { setupMfa, enableMfa, verifyMfa, AuthResponse } from '../services/authService';

interface MfaModalProps {
  isOpen: boolean;
  onClose: () => void;
  mfaToken: string;
  setupRequired?: boolean;
  onSuccess: (result: AuthResponse) => void;
}

const MfaModal: React.FC<MfaModalProps> = ({
  isOpen,
  onClose,
  mfaToken,
  setupRequired = false,
  onSuccess
}) => {
  const [step, setStep] = useState<'verify' | 'setup' | 'recovery'>(setupRequired ? 'setup' : 'verify');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && setupRequired && !setupData) {
      handleSetup();
    }
  }, [isOpen, setupRequired]);

  const handleSetup = async () => {
    setLoading(true);
    setError('');
    const result = await setupMfa(mfaToken);
    if (result.success && result.data) {
      setSetupData(result.data);
    } else {
      const errStr = typeof result.error === 'object' ? result.error.message : result.error;
      setError(errStr || 'Failed to initialize MFA setup');
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 && step !== 'recovery') return;

    setLoading(true);
    setError('');

    if (step === 'setup' && setupData) {
      const result = await enableMfa(mfaToken, setupData.secret, code);
      if (result.success && result.data) {
        setRecoveryCodes(result.data.recoveryCodes);
        setStep('recovery');
      } else {
        const errStr = typeof result.error === 'object' ? result.error.message : result.error;
        setError(errStr || 'Invalid verification code');
      }
    } else {
      const result = await verifyMfa(mfaToken, code);
      if (result.success) {
        onSuccess(result);
        onClose();
      } else {
        setError(result.error || 'Invalid verification code');
      }
    }
    setLoading(false);
  };

  const copyRecoveryCodes = () => {
    const text = recoveryCodes.join('\n');
    navigator.clipboard.writeText(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-[#4B0082] to-[#6A0DAD] p-6 text-white text-center">
          <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold">
            {step === 'setup' ? 'Setup Two-Factor Auth' : 
             step === 'recovery' ? 'MFA Enabled' : 'Security Verification'}
          </h2>
          <p className="text-white/80 text-sm mt-2">
            {step === 'setup' ? 'Protect your account with an authenticator app' : 
             step === 'recovery' ? 'Save these recovery codes in a secure place' : 'Enter the 6-digit code from your app'}
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg flex items-center space-x-2 mb-6 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'setup' && setupData ? (
            <div className="space-y-6 text-center">
              <div className="bg-gray-50 p-4 rounded-xl inline-block border-2 border-dashed border-gray-200">
                <img src={setupData.qrCode} alt="MFA QR Code" className="w-48 h-48 mx-auto" />
              </div>
              
              <div className="text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Manual Entry Key</p>
                <div className="bg-gray-100 p-3 rounded-lg font-mono text-sm break-all flex justify-between items-center">
                  <span>{setupData.secret}</span>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-4">
                <div className="text-left">
                  <label className="text-xs font-bold text-[#4B0082] uppercase tracking-wider mb-2 block">Verification Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-[#FFD700] focus:outline-none"
                    placeholder="000000"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full bg-[#FFD700] text-[#4B0082] py-3 rounded-xl font-bold shadow-lg hover:bg-[#FDB931] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Confirm Setup'}
                </button>
              </form>
            </div>
          ) : step === 'recovery' ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 p-4 rounded-xl flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-500" />
                <p className="text-sm text-green-800 font-medium">MFA has been successfully enabled!</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {recoveryCodes.map((code, idx) => (
                  <div key={idx} className="bg-gray-100 p-2 rounded text-center font-mono text-xs text-gray-700 border border-gray-200">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={copyRecoveryCodes}
                  className="flex-1 flex items-center justify-center space-x-2 border border-gray-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy All</span>
                </button>
                <button
                  onClick={() => {
                    // We need to re-login after setup to get the real token
                    onClose();
                    window.location.reload(); // Simple way to reset login state
                  }}
                  className="flex-1 bg-[#4B0082] text-white py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-[#6A0DAD]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="text-center space-y-4">
                <Smartphone className="h-12 w-12 text-[#4B0082] mx-auto opacity-20" />
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#4B0082] uppercase tracking-wider block">Authenticator Code</label>
                  <input
                    type="text"
                    autoFocus
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-center text-3xl font-bold tracking-[0.5em] focus:ring-2 focus:ring-[#FFD700] focus:outline-none"
                    placeholder="000000"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 text-gray-500 font-semibold hover:text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="flex-[2] bg-[#FFD700] text-[#4B0082] py-3 rounded-xl font-bold shadow-lg hover:bg-[#FDB931] transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Verify & Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default MfaModal;









