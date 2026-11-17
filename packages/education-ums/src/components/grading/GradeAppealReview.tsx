/**
 * BMI UMS - Grade Appeal Review Component
 * Allows instructors to review and respond to grade appeals
 */

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, FileText, Calendar } from '../../shims/lucide-react';
import { GradeAppeal, AppealStatus } from '../../grading/types';

interface GradeAppealReviewProps {
  isOpen: boolean;
  onClose: () => void;
  onApprove: (appealId: string, revisedGrade: string, notes: string) => Promise<void>;
  onDeny: (appealId: string, notes: string) => Promise<void>;
}

const GradeAppealReview: React.FC<GradeAppealReviewProps> = ({
  isOpen,
  onClose,
  onApprove,
  onDeny,
}) => {
  const [appeals, setAppeals] = useState<GradeAppeal[]>([]);
  const [selectedAppeal, setSelectedAppeal] = useState<GradeAppeal | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [revisedGrade, setRevisedGrade] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [filter, setFilter] = useState<AppealStatus | 'ALL'>('ALL');

  // Fetch grade appeals from database API
  useEffect(() => {
    if (isOpen) {
      import('../../services/authService').then(({ authFetch }) => {
        import('../../services/config').then(({ API_URL }) => {
          authFetch(`${API_URL}/grades/appeals`)
            .then(res => res.json())
            .then(data => {
              if (data.success && Array.isArray(data.data)) {
                setAppeals(data.data);
              } else {
                setAppeals([]);
              }
            })
            .catch(() => setAppeals([]));
        });
      });
    }
  }, [isOpen]);

  const handleApprove = async () => {
    if (!selectedAppeal || !revisedGrade.trim() || !reviewNotes.trim()) {
      alert('Please provide both a revised grade and review notes');
      return;
    }

    setIsProcessing(true);
    try {
      await onApprove(selectedAppeal.id, revisedGrade, reviewNotes);
      setSelectedAppeal(null);
      setReviewNotes('');
      setRevisedGrade('');
      // Refresh appeals list
    } catch (error) { // eslint-disable-next-line no-console
      console.error('Failed to approve appeal:', error);
     } finally {
      setIsProcessing(false);
    }
  };

  const handleDeny = async () => {
    if (!selectedAppeal || !reviewNotes.trim()) {
      alert('Please provide review notes explaining the denial');
      return;
    }

    setIsProcessing(true);
    try {
      await onDeny(selectedAppeal.id, reviewNotes);
      setSelectedAppeal(null);
      setReviewNotes('');
      // Refresh appeals list
    } catch (error) { // eslint-disable-next-line no-console
      console.error('Failed to deny appeal:', error);
     } finally {
      setIsProcessing(false);
    }
  };

  const filteredAppeals = filter === 'ALL' 
    ? appeals 
    : appeals.filter(a => a.status === filter);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-6xl border-4 border-[#4B0082] shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[#4B0082] text-white p-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <FileText size={24} />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Grade Appeals Review</h2>
              <p className="text-xs text-purple-200 mt-1">Review and respond to student grade appeals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            {['ALL', AppealStatus.SUBMITTED, AppealStatus.UNDER_REVIEW, AppealStatus.APPROVED, AppealStatus.DENIED].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status as AppealStatus | 'ALL')}
                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all ${
                  filter === status
                    ? 'bg-[#4B0082] text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Appeals List */}
          <div className="w-1/3 border-r-2 border-gray-200 dark:border-gray-700 overflow-y-auto">
            {filteredAppeals.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm font-bold">No appeals found</p>
                <p className="text-xs mt-1">Appeals will appear here when submitted</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredAppeals.map((appeal) => (
                  <button
                    key={appeal.id}
                    onClick={() => setSelectedAppeal(appeal)}
                    className={`w-full p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      selectedAppeal?.id === appeal.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className={`px-2 py-1 text-xs font-black uppercase ${
                        appeal.status === AppealStatus.SUBMITTED ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                        appeal.status === AppealStatus.UNDER_REVIEW ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400' :
                        appeal.status === AppealStatus.APPROVED ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        {appeal.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                      {appeal.reason}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Original Grade: <span className="font-bold">{appeal.originalGrade}</span>
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <Calendar size={12} />
                      {new Date(appeal.submittedAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Appeal Details */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedAppeal ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FileText size={64} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-bold">Select an appeal to review</p>
                  <p className="text-xs mt-1">Choose an appeal from the list to view details</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Appeal Information */}
                <div>
                  <h3 className="text-lg font-black uppercase text-gray-900 dark:text-white mb-4">
                    Appeal Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Appeal ID</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{selectedAppeal.id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Submitted</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {new Date(selectedAppeal.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Original Grade</p>
                      <p className="text-2xl font-black text-[#4B0082]">{selectedAppeal.originalGrade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                      <span className={`inline-block px-3 py-1 text-xs font-black uppercase ${
                        selectedAppeal.status === AppealStatus.SUBMITTED ? 'bg-blue-100 text-blue-800' :
                        selectedAppeal.status === AppealStatus.UNDER_REVIEW ? 'bg-amber-100 text-amber-800' :
                        selectedAppeal.status === AppealStatus.APPROVED ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {selectedAppeal.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <h4 className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-2">
                    Reason for Appeal
                  </h4>
                  <p className="text-sm font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-900 p-4 border-l-4 border-[#4B0082]">
                    {selectedAppeal.reason}
                  </p>
                </div>

                {/* Explanation */}
                <div>
                  <h4 className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-2">
                    Student Explanation
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 border-2 border-gray-200 dark:border-gray-700">
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {selectedAppeal.explanation}
                    </p>
                  </div>
                </div>

                {/* Review Section (only for pending appeals) */}
                {selectedAppeal.status === AppealStatus.SUBMITTED && (
                  <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-4">
                      Review Decision
                    </h4>

                    {/* Revised Grade (for approval) */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Revised Grade (if approving)
                      </label>
                      <input
                        type="text"
                        value={revisedGrade}
                        onChange={(e) => setRevisedGrade(e.target.value)}
                        placeholder="e.g., A-, B+, etc."
                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
                      />
                    </div>

                    {/* Review Notes */}
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">
                        Review Notes *
                      </label>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={4}
                        placeholder="Provide detailed notes explaining your decision..."
                        className="w-full px-4 py-2 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm outline-none focus:border-[#4B0082] dark:text-white resize-none"
                        required
                      />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                      <button
                        onClick={handleApprove}
                        disabled={isProcessing || !reviewNotes.trim() || !revisedGrade.trim()}
                        className="flex-1 px-6 py-3 bg-green-600 text-white font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <CheckCircle size={16} />
                        Approve Appeal
                      </button>
                      <button
                        onClick={handleDeny}
                        disabled={isProcessing || !reviewNotes.trim()}
                        className="flex-1 px-6 py-3 bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <XCircle size={16} />
                        Deny Appeal
                      </button>
                    </div>
                  </div>
                )}

                {/* Review History (for processed appeals) */}
                {selectedAppeal.status !== AppealStatus.SUBMITTED && selectedAppeal.reviewNotes && (
                  <div className="border-t-2 border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-4">
                      Review History
                    </h4>
                    <div className="bg-gray-50 dark:bg-gray-900 p-4 border-2 border-gray-200 dark:border-gray-700">
                      {selectedAppeal.revisedGrade && (
                        <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                          Revised Grade: <span className="text-[#4B0082]">{selectedAppeal.revisedGrade}</span>
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Reviewed by: {selectedAppeal.reviewedBy || 'Instructor'}
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {selectedAppeal.reviewNotes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GradeAppealReview;









