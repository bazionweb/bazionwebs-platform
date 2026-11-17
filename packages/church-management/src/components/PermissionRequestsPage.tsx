import React, { useState, useEffect } from 'react';
import { PermissionRequest, PermissionStatusBadge } from './PermissionRequest';
import { User } from './userData';

import { Shield, Search, CheckCircle, XCircle, Eye, Clock } from 'lucide-react';
import { useToast } from './ToastContext';

interface PermissionRequestsPageProps {
  currentUser: User;
  permissionRequests: PermissionRequest[];
  onReview: (requestId: string, action: 'approve' | 'deny', notes: string) => Promise<void>;
}

const PermissionRequestsPage: React.FC<PermissionRequestsPageProps> = ({
  currentUser: _currentUser,
  permissionRequests: initialRequests,
  onReview,
}) => {
  const { showToast } = useToast();
  const [requests, setRequests] = useState<PermissionRequest[]>(initialRequests);
  const [loading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<PermissionRequest | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'deny'>('approve');

  // Update local state when props change
  useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  // Filter requests
  const filteredRequests = requests.filter((request) => {
    const matchesSearch =
      request.requesterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.dataName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.dataType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.reason.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || request.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Handle request review
  const handleReviewRequest = async (requestId: string, action: 'approve' | 'deny', notes: string) => {
    try {
      await onReview(requestId, action, notes);
      showToast(
        `Permission request ${action === 'approve' ? 'approved' : 'denied'} successfully!`,
        action === 'approve' ? 'success' : 'info',
      );
    } catch (error) {
      console.error('Error reviewing request:', error);
      showToast('Failed to review request', 'error');
    }
  };

  const openReviewModal = (request: PermissionRequest, action: 'approve' | 'deny') => {
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewNotes('');
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    if (!selectedRequest) return;
    await handleReviewRequest(selectedRequest.id, reviewAction, reviewNotes);
    setShowReviewModal(false);
    setSelectedRequest(null);
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    denied: requests.filter((r) => r.status === 'denied').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="w-6 h-6 text-orange-600" />
            Permission Requests
          </h1>
          <p className="text-gray-500">Review and manage edit permission requests from users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-700">{stats.total}</p>
              <p className="text-sm text-blue-600">Total Requests</p>
            </div>
          </div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
              <p className="text-sm text-yellow-600">Pending Review</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
              <p className="text-sm text-green-600">Approved</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-700">{stats.denied}</p>
              <p className="text-sm text-red-600">Denied</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="denied">Denied</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            {requests.length === 0 ? 'No permission requests yet' : 'No requests match your search'}
          </h3>
          <p className="text-gray-500 mb-4">
            {requests.length === 0
              ? 'When users with Editor permissions need to edit existing data, their requests will appear here for your approval.'
              : 'Try adjusting your search terms or filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requested</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-800">
                        {request.requestType === 'edit' ? '✏️' : '🗑️'} {request.requestType.toUpperCase()}{' '}
                        {request.dataType}
                      </p>
                      <p className="text-sm text-gray-600">{request.dataName}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{request.reason}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-800">{request.requesterName}</p>
                      <p className="text-sm text-gray-600">{request.requesterEmail}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <PermissionStatusBadge status={request.status} />
                    {request.status === 'approved' && request.expiresAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Expires: {new Date(request.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(request.requestedAt).toLocaleDateString()}
                    <br />
                    {new Date(request.requestedAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {request.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openReviewModal(request, 'approve')}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            title="Approve Request"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openReviewModal(request, 'deny')}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Deny Request"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedRequest(request)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div
              className={`p-4 border-b rounded-t-xl ${reviewAction === 'approve' ? 'bg-green-600' : 'bg-red-600'} text-white`}
            >
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {reviewAction === 'approve' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {reviewAction === 'approve' ? 'Approve' : 'Deny'} Permission Request
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm">
                  <strong>Requester:</strong> {selectedRequest.requesterName}
                </p>
                <p className="text-sm">
                  <strong>Request:</strong> {selectedRequest.requestType} {selectedRequest.dataType}
                </p>
                <p className="text-sm">
                  <strong>Item:</strong> {selectedRequest.dataName}
                </p>
                <p className="text-sm">
                  <strong>Reason:</strong> {selectedRequest.reason}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes {reviewAction === 'deny' ? '*' : '(Optional)'}
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={`Add notes about your ${reviewAction} decision...`}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 resize-none"
                  rows={3}
                  required={reviewAction === 'deny'}
                />
              </div>

              {reviewAction === 'approve' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm text-green-700">✅ This will grant temporary edit access for 24 hours.</p>
                </div>
              )}
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-2">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitReview}
                className={`px-4 py-2 rounded-lg text-white font-medium ${
                  reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                }`}
                disabled={reviewAction === 'deny' && !reviewNotes.trim()}
              >
                {reviewAction === 'approve' ? 'Approve Request' : 'Deny Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PermissionRequestsPage;
