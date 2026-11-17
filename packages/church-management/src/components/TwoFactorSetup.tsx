import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, ShieldOff, Copy, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import {
  generate2FASecret,
  get2FAQRCodeURL,
  verifyTOTP,
  store2FASecret,
  enable2FA,
  disable2FA,
  is2FAEnabled,
  get2FASecret,
} from '../services/security';
import { User } from './userData';

interface TwoFactorSetupProps {
  user: User;
  onClose: () => void;
}

const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({ user, onClose }) => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [secret, setSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'status' | 'setup' | 'verify' | 'disable'>('status');

  useEffect(() => {
    is2FAEnabled(user.id).then(setIsEnabled);
  }, [user.id]);

  const handleStartSetup = async () => {
    const newSecret = generate2FASecret();
    setSecret(newSecret);
    setQrCodeUrl(get2FAQRCodeURL(user.email, newSecret));
    await store2FASecret(user.id, newSecret);
    setStep('setup');
    setError('');
    setSuccess('');
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Failed to copy to clipboard');
    }
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const storedSecret = await get2FASecret(user.id);
      if (!storedSecret) {
        setError('2FA setup not found. Please try again.');
        setStep('status');
        return;
      }

      const isValid = await verifyTOTP(storedSecret, verificationCode);

      if (isValid) {
        await enable2FA(user.id);
        setIsEnabled(true);
        setSuccess('Two-factor authentication has been enabled successfully!');
        setStep('status');
        setVerificationCode('');
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter your current 2FA code to disable');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const storedSecret = await get2FASecret(user.id);
      if (!storedSecret) {
        setError('2FA not configured');
        return;
      }

      const isValid = await verifyTOTP(storedSecret, verificationCode);

      if (isValid) {
        await disable2FA(user.id);
        setIsEnabled(false);
        setSuccess('Two-factor authentication has been disabled.');
        setStep('status');
        setVerificationCode('');
      } else {
        setError('Invalid verification code.');
      }
    } catch {
      setError('Failed to disable 2FA.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">Two-Factor Authentication</h2>
              <p className="text-green-100 text-sm">Secure your account with 2FA</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <XCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {/* Status View */}
          {step === 'status' && (
            <div className="text-center">
              <div
                className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 ${isEnabled ? 'bg-green-100' : 'bg-gray-100'}`}
              >
                {isEnabled ? (
                  <ShieldCheck className="w-10 h-10 text-green-600" />
                ) : (
                  <ShieldOff className="w-10 h-10 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isEnabled ? '2FA is Enabled' : '2FA is Not Enabled'}
              </h3>
              <p className="text-gray-600 mb-6">
                {isEnabled
                  ? 'Your account is protected with two-factor authentication.'
                  : 'Add an extra layer of security to your account by enabling 2FA.'}
              </p>

              {isEnabled ? (
                <button
                  onClick={() => {
                    setStep('disable');
                    setError('');
                    setSuccess('');
                  }}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Disable 2FA
                </button>
              ) : (
                <button
                  onClick={handleStartSetup}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Enable 2FA
                </button>
              )}
            </div>
          )}

          {/* Setup View */}
          {step === 'setup' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 1: Scan QR Code</h3>
              <p className="text-gray-600 text-sm mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>

              <div className="flex justify-center mb-4">
                <img src={qrCodeUrl} alt="2FA QR Code" className="border-4 border-gray-200 rounded-lg" />
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Or enter this code manually:</p>
                <div className="flex items-center gap-2 bg-gray-100 p-3 rounded-lg">
                  <code className="flex-1 font-mono text-sm tracking-wider">{secret}</code>
                  <button
                    onClick={handleCopySecret}
                    className="p-2 hover:bg-gray-200 rounded transition"
                    title="Copy to clipboard"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setStep('verify');
                  setError('');
                }}
                className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
              >
                Continue to Verification
              </button>
            </div>
          )}

          {/* Verify View */}
          {step === 'verify' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Step 2: Verify Setup</h3>
              <p className="text-gray-600 text-sm mb-4">
                Enter the 6-digit code from your authenticator app to complete setup.
              </p>

              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none mb-4"
                maxLength={6}
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('setup')}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleVerify}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Enable'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Disable View */}
          {step === 'disable' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Disable Two-Factor Authentication</h3>
              <p className="text-gray-600 text-sm mb-4">
                Enter your current 2FA code to disable two-factor authentication.
              </p>

              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none mb-4"
                maxLength={6}
                autoFocus
              />

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('status');
                    setVerificationCode('');
                    setError('');
                  }}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisable}
                  disabled={isVerifying || verificationCode.length !== 6}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Disable 2FA'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <button onClick={onClose} className="w-full py-2 text-gray-600 hover:text-gray-800 transition">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;
