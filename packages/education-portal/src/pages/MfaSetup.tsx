import { useState, useEffect } from 'react';
import { useNavigate } from '../shims/react-router-dom';
import { api } from '../lib/api';
import { QRCodeSVG } from '../shims/qrcode-react';

export default function MfaSetup() {
  const [otpAuthUrl, setOtpAuthUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function setup() {
      try {
        const res = await api.auth.mfaSetup();
        setSecret(res.secret);
        setOtpAuthUrl(res.otp_auth_url);
      } catch (err: any) {
        setError(err.response?.data?.error || err.message);
      }
    }
    setup();
  }, []);

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.auth.mfaEnable(token);
      setSuccess(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
    }
  }



  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-[#0f172a]">Set Up Two-Factor Authentication</h2>
          <p className="mt-2 text-sm text-gray-600">Add an extra layer of security to your account.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">MFA enabled successfully! Redirecting...</div>}

        {secret && (
          <form onSubmit={handleEnable} className="mt-8 space-y-6">
            <div className="text-center">
              <div className="bg-gray-100 p-4 rounded-lg inline-block mb-4">
                {otpAuthUrl ? (
                  <QRCodeSVG value={otpAuthUrl} size={192} />
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-md flex items-center justify-center">
                    <span className="text-gray-500">QR Code</span>
                  </div>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">Scan this QR code with your authenticator app (like Google Authenticator or Authy).</p>
              <p className="text-sm text-gray-500">Or enter this secret key manually:</p>
              <p className="font-mono text-lg text-[#d4af37] mt-2">{secret}</p>
            </div>

            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700">Enter the 6-digit code from your app</label>
              <input
                type="text"
                id="token"
                name="token"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                maxLength={6}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#d4af37] focus:border-[#d4af37]"
                placeholder="123456"
              />
            </div>

            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-[#0f172a] bg-[#d4af37] hover:bg-[#c19d2e] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#d4af37]"
            >
              Enable Two-Factor Authentication
            </button>
          </form>
        )}

        <div className="text-center">
          <button onClick={() => navigate('/dashboard')} className="text-sm text-gray-600 hover:text-[#d4af37]">
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
