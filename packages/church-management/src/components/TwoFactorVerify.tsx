import React, { useState } from 'react';
import { Shield, Loader2, XCircle } from 'lucide-react';
import { verifyTOTP, get2FASecret, logAuditEvent, AuditActions } from '../services/security';

interface TwoFactorVerifyProps {
  userId: string;
  userEmail: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const TwoFactorVerify: React.FC<TwoFactorVerifyProps> = ({ userId, userEmail, onSuccess, onCancel }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const secret = await get2FASecret(userId);
      if (!secret) {
        setError('2FA configuration not found');
        return;
      }

      const isValid = await verifyTOTP(secret, code);

      if (isValid) {
        logAuditEvent(AuditActions.TWO_FA_VERIFIED, 'auth', userId, `2FA verified for: ${userEmail}`);
        onSuccess();
      } else {
        setError('Invalid verification code. Please try again.');
        setCode('');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-3">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Two-Factor Authentication</h2>
          <p className="text-green-100 text-sm mt-1">Enter the code from your authenticator app</p>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={handleKeyDown}
            placeholder="000000"
            className="w-full text-center text-3xl font-mono tracking-[0.5em] p-4 border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none mb-4"
            maxLength={6}
            autoFocus
            disabled={isVerifying}
          />

          <button
            onClick={handleVerify}
            disabled={isVerifying || code.length !== 6}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify'
            )}
          </button>

          <button
            onClick={onCancel}
            disabled={isVerifying}
            className="w-full mt-3 py-2 text-gray-600 hover:text-gray-800 transition text-sm"
          >
            Cancel and go back
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;
