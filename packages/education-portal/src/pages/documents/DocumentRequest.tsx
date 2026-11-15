import { useState } from 'react';
import { api } from '../../lib/api';

export default function DocumentRequest() {
  const [docType, setDocType] = useState('transcript');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Initialize Paystack transaction (backend-only; payee: BEMI TRAINING INSTITUTE)
      const intent = await api.payments.createIntent({
        amount: 15,
        reason: `Document Request: ${docType}`,
        currency: 'NGN',
      });

      const checkoutUrl = intent.authorizationUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      alert(`Payment initialized with ${intent.merchant}. Complete checkout to proceed.`);
    } catch (err: any) {
      alert(err?.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Self-Service Documents</h1>
      <div className="bg-white p-6 rounded shadow">
        <form onSubmit={handleRequest} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Document Type</label>
            <select
              className="w-full border p-2 rounded"
              value={docType}
              onChange={e => setDocType(e.target.value)}
            >
              <option value="transcript">Official Transcript ($15)</option>
              <option value="certificate">Degree Certificate ($25)</option>
              <option value="enrollment_letter">Enrollment Letter (Free)</option>
            </select>
          </div>
          <p className="text-xs text-gray-500">
            Payments secured by Paystack • Payee: BEMI TRAINING INSTITUTE (trading as BMI University)
          </p>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Request Document'}
          </button>
        </form>
      </div>
    </div>
  );
}
