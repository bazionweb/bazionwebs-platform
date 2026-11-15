import React, { useState } from 'react';
import { X, User, Phone, MapPin, Save, Loader2, Download, ShieldAlert } from '../shims/lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authFetch } from '../services/authService';
import { useDialogStore } from '../stores/dialogStore';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await authFetch('/api/v1/auth/export-data', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bmi_data_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     } finally {
      setIsExporting(false);
    }
  };

  const handleForgetMe = async () => {
    const confirmed = await useDialogStore.getState().confirm({
      title: "Permanently Delete Your Account",
      message: "Are you sure you want to submit a Right to Erasure request? This will permanently deactivate your account and scrub all your personal data from the BMI University ERP system.",
      detail: "This action is compliant with institutional GDPR and data protection policy. Once submitted, your account credentials, profile data, and access permissions will be permanently revoked and cannot be recovered. You will be logged out immediately.",
      confirmText: "Submit Erasure Request",
      cancelText: "Cancel",
      variant: "danger",
      badgeText: "Data Protection Protocol",
    });
    if (!confirmed) return;
    
    try {
      const res = await authFetch('/api/v1/auth/forget-me', { method: 'POST' });
      if (res.ok) {
        await useDialogStore.getState().alert({
          title: "Data Erasure Complete",
          message: "Your personal data has been successfully scrubbed from the BMI University institutional systems. You will now be logged out.",
          variant: "info",
          confirmText: "Log Out Now",
          badgeText: "Data Protection Notice",
        });
        window.location.reload();
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
     }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/v1/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, phone, address }),
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          window.location.reload(); // Refresh to update user info in store
        }, 1500);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error(error);
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
            <User size={18} />
            <span className="font-black uppercase text-xs tracking-widest">Update Profile</span>
          </div>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Phone Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold"
                placeholder="+254..."
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Physical Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 text-gray-400" size={14} />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 outline-none focus:border-[#4B0082] text-sm font-bold resize-none"
                placeholder="City, Estate, House No."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-[#4B0082] text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {success ? 'Profile Updated!' : 'Save Changes'}
          </button>

          <div className="pt-6 border-t border-gray-100 dark:border-gray-700 space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-400">Privacy & Data Rights</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center justify-center gap-2 py-2 border border-gray-200 dark:border-gray-700 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-900 transition-all"
              >
                {isExporting ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
                Export Data
              </button>
              <button
                type="button"
                onClick={handleForgetMe}
                className="flex items-center justify-center gap-2 py-2 border border-red-100 dark:border-red-900/30 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
              >
                <ShieldAlert size={12} />
                Forget Me
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileModal;









