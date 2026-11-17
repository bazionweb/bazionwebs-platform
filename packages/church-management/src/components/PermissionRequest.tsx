import React, { useState } from 'react';
import { User } from './userData';
import { PaperAirplaneIcon, XCircleIcon, ClockIcon } from './Icons';
import { AlertTriangle, Lock, Send, Clock } from 'lucide-react';

export interface PermissionRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requestType: 'edit' | 'delete';
  dataType:
    'Member' | 'Transaction' | 'Equipment' | 'Visitor' | 'Group' | 'Branch' | 'AttendanceRecord' | 'MaintenanceRecord';
  dataId: string | number;
  dataName: string; // Name/title of the item being edited
  reason: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  expiresAt?: string; // Approved permissions expire after set time
}

interface PermissionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  dataType: string;
  dataName: string;
  requestType: 'edit' | 'delete';
  currentUser: User;
}

export const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  dataType,
  dataName,
  requestType,
  currentUser,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to submit permission request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        {/* Header */}
        <div className="p-4 border-b bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <Lock className="w-6 h-6" />
            <h2 className="text-lg font-bold">Permission Required</h2>
          </div>
          <p className="text-orange-100 text-sm mt-1">Request approval to {requestType} existing data</p>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Request Details */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800">You need Super Admin approval to {requestType}:</p>
                <p className="text-sm text-orange-700 mt-1">
                  <strong>{dataType}:</strong> {dataName}
                </p>
              </div>
            </div>
          </div>

          {/* Reason Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for {requestType} request *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Explain why you need to ${requestType} this ${dataType.toLowerCase()}...`}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
              rows={4}
              required
              maxLength={500}
            />
            <p className="text-xs text-gray-500 mt-1">{reason.length}/500 characters</p>
          </div>

          {/* Request Info */}
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              <strong>Requester:</strong> {currentUser.username} ({currentUser.email})
            </p>
            <p className="text-xs text-gray-600 mt-1">
              <strong>Request Time:</strong> {new Date().toLocaleString()}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50"
              disabled={isSubmitting || !reason.trim()}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 pb-6">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-xs text-blue-700">
              💡 Your request will be sent to the Super Admin for review. You'll be notified when a decision is made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Permission Request Status Badge
interface PermissionStatusBadgeProps {
  status: PermissionRequest['status'];
  className?: string;
}

export const PermissionStatusBadge: React.FC<PermissionStatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusConfig = (status: PermissionRequest['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'Pending' };
      case 'approved':
        return { color: 'bg-green-100 text-green-800', icon: PaperAirplaneIcon, text: 'Approved' };
      case 'denied':
        return { color: 'bg-red-100 text-red-800', icon: XCircleIcon, text: 'Denied' };
      case 'expired':
        return { color: 'bg-gray-100 text-gray-800', icon: ClockIcon, text: 'Expired' };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: ClockIcon, text: 'Unknown' };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.color} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {config.text}
    </span>
  );
};

export default PermissionRequestModal;
