import React from 'react';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { ArrowLeftIcon } from '../Icons';

interface VerificationScreenProps {
  verificationEmail: string;
  successMessage: string;
  error: string;
  isLoading: boolean;
  resendCooldown: number;
  onResendVerification: () => void;
  onBack: () => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  verificationEmail,
  successMessage,
  error,
  isLoading,
  resendCooldown,
  onResendVerification,
  onBack,
}) => {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify Your Email</h2>
            <p className="text-gray-600">We've sent a verification link to:</p>
            <p className="font-semibold text-gray-800 mt-1">{verificationEmail}</p>
          </div>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Click the verification link in your email to activate your account. The link will expire in 24 hours.
            </p>

            <div className="border-t pt-4">
              <p className="text-sm text-gray-600 mb-3">Didn't receive the email?</p>
              <button
                type="button"
                onClick={onResendVerification}
                disabled={isLoading || resendCooldown > 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                {isLoading
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Verification Email'}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="mt-6 text-sm text-gray-600 hover:text-gray-800 flex items-center justify-center w-full"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default VerificationScreen;
