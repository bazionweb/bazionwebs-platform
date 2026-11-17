import React, { useState } from 'react';
import { X, FileText, Send, Loader2, CheckCircle } from '../shims/lucide-react';
import { authFetch } from '../services/authService';

interface DocumentRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentRequestModal: React.FC<DocumentRequestModalProps> = ({ isOpen, onClose }) => {
  const [type, setType] = useState('Transcript');
  const [purpose, setPurpose] = useState('');
  const [delivery, setDelivery] = useState('Digital');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/v1/documents/request', {
        method: 'POST',
        body: JSON.stringify({
          type,
          purpose,
          deliveryMethod: delivery,
          address: delivery !== 'Digital' ? address : undefined,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
        }, 2000);
      }
    } catch (_error) { // eslint-disable-next-line no-console
      console.error(_error);
     } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-md border-2 border-[#4B0082] shadow-2xl">
        <div className="bg-[#4B0082] text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText size={18} />
            <span className="font-black uppercase text-xs tracking-widest">Request Document</span>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        {success ? (
          <div className="p-12 text-center space-y-4">
            <CheckCircle size={48} className="text-emerald-500 mx-auto" />
            <p className="font-black uppercase text-sm tracking-widest text-gray-900 dark:text-white">Request Submitted!</p>
            <p className="text-xs text-gray-500">The registrar's office will review your request shortly.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Document Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold"
              >
                <option>Transcript</option>
                <option>Certificate</option>
                <option>Letter of Good Standing</option>
                <option>Admission Letter</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Purpose of Request</label>
              <input
                type="text"
                required
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. Further Studies, Employment"
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Delivery Method</label>
              <select
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold"
              >
                <option>Digital</option>
                <option>Physical Pickup</option>
                <option>Courier</option>
              </select>
            </div>

            {delivery !== 'Digital' && (
              <div>
                <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Delivery Address / Notes</label>
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold resize-none"
                  placeholder="Enter full address or pickup instructions"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#4B0082] text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              Submit Request
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default DocumentRequestModal;









