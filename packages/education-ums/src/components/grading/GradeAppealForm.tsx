/**
 * BMI UMS - Grade Appeal Form Component
 * Allows students to submit grade appeals with written explanations
 */

import React, { useState } from 'react';
import { X, AlertCircle, FileText, Send } from '../../shims/lucide-react';
import { Grade } from '../../grading/types';

interface GradeAppealFormProps {
  grade: Grade;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (appealData: AppealFormData) => Promise<void>;
}

export interface AppealFormData {
  gradeId: string;
  reason: string;
  explanation: string;
  supportingDocuments?: File[];
}

const GradeAppealForm: React.FC<GradeAppealFormProps> = ({
  grade,
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!reason.trim()) {
      setError('Please select a reason for your appeal');
      return;
    }
    
    if (!explanation.trim() || explanation.trim().length < 50) {
      setError('Please provide a detailed explanation (minimum 50 characters)');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit({
        gradeId: grade.id,
        reason,
        explanation,
      });
      
      // Reset form
      setReason('');
      setExplanation('');
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : 'Failed to submit appeal');
     } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl border-4 border-[#4B0082] shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-[#4B0082] text-white p-6 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <FileText size={24} />
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight">Grade Appeal</h2>
              <p className="text-xs text-purple-200 mt-1">Submit a formal grade appeal request</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Grade Information */}
        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-b-2 border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-3">
            Grade Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Course</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {grade.courseCode} - {grade.courseName}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Current Grade</p>
              <p className="text-2xl font-black text-[#4B0082]">{grade.letterGrade}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Semester</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {grade.semester} {grade.academicYear}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Grade Points</p>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {grade.gradePoints.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Appeal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-500 p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800 dark:text-red-200">Error</p>
                <p className="text-xs text-red-700 dark:text-red-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-2">
              Reason for Appeal *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm font-bold outline-none focus:border-[#4B0082] dark:text-white"
              required
            >
              <option value="">Select a reason...</option>
              <option value="Grading Error">Grading Error - Calculation mistake</option>
              <option value="Missing Work">Missing Work - Submitted work not graded</option>
              <option value="Unfair Assessment">Unfair Assessment - Grading criteria unclear</option>
              <option value="Technical Issue">Technical Issue - System or submission problem</option>
              <option value="Extenuating Circumstances">Extenuating Circumstances - Personal/medical reasons</option>
              <option value="Other">Other - Please explain in detail</option>
            </select>
          </div>

          {/* Detailed Explanation */}
          <div>
            <label className="block text-sm font-black uppercase text-gray-700 dark:text-gray-300 mb-2">
              Detailed Explanation *
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Provide a clear and detailed explanation of why you believe your grade should be reviewed.
              Include specific examples, dates, and any relevant information. (Minimum 50 characters)
            </p>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 text-sm font-medium outline-none focus:border-[#4B0082] dark:text-white resize-none"
              placeholder="Explain your appeal in detail..."
              required
              minLength={50}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {explanation.length} / 50 minimum characters
            </p>
          </div>

          {/* Important Notice */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-500 p-4">
            <h4 className="text-sm font-black uppercase text-amber-800 dark:text-amber-200 mb-2">
              Important Notice
            </h4>
            <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li>Your instructor will be notified of this appeal</li>
              <li>Appeals are reviewed within 5-7 business days</li>
              <li>You will receive an email notification when a decision is made</li>
              <li>Submitting an appeal does not guarantee a grade change</li>
              <li>False or frivolous appeals may result in disciplinary action</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t-2 border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-black text-xs uppercase tracking-widest hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-[#4B0082] text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit Appeal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GradeAppealForm;









