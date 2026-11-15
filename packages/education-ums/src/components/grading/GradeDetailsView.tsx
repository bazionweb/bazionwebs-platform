/**
 * BMI UMS - Grade Details View Component
 * Displays detailed grade breakdown with components, GPA, and audit trail
 */

import React, { useState, useEffect } from 'react';
import { X, Clock, User, AlertCircle } from '../../shims/lucide-react';
import { Grade, GradeAuditLog } from '../../grading/types';
import { getGrade } from '../../grading/services/GradeAPIService';

interface GradeDetailsViewProps {
  gradeId: string;
  isOpen: boolean;
  onClose: () => void;
}

const GradeDetailsView: React.FC<GradeDetailsViewProps> = ({ gradeId, isOpen, onClose }) => {
  const [grade, setGrade] = useState<Grade | null>(null);
  const [auditLog] = useState<GradeAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'components' | 'history'>('details');

  useEffect(() => {
    if (isOpen && gradeId) {
      loadGradeDetails();
    }
  }, [isOpen, gradeId]);

  const loadGradeDetails = async () => {
    setIsLoading(true);
    try {
      const response = await getGrade(gradeId);
      if (response.success && response.data) {
        setGrade(response.data);
      }
    } catch (error) { // eslint-disable-next-line no-console
      console.error('Failed to load grade details:', error);
     } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden border-4 border-[#4B0082] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest">Grade Details</h2>
            {grade && (
              <p className="text-xs text-gray-400 mt-1">
                {grade.studentName} - {grade.courseCode}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === 'details'
                ? 'bg-white dark:bg-gray-800 text-[#4B0082] border-b-4 border-[#4B0082]'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === 'components'
                ? 'bg-white dark:bg-gray-800 text-[#4B0082] border-b-4 border-[#4B0082]'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Components
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === 'history'
                ? 'bg-white dark:bg-gray-800 text-[#4B0082] border-b-4 border-[#4B0082]'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            History
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-12 h-12 border-4 border-[#4B0082]/30 border-t-[#4B0082] rounded-full animate-spin"></div>
            </div>
          ) : grade ? (
            <>
              {/* Overview Tab */}
              {activeTab === 'details' && (
                <div className="space-y-6">
                  {/* Grade Summary Card */}
                  <div className="bg-gradient-to-br from-[#4B0082] to-[#7B1FA2] text-white p-6 rounded-lg">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Letter Grade</p>
                        <p className="text-5xl font-black">{grade.letterGrade}</p>
                      </div>
                      <div className="text-center border-x border-white/20">
                        <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Numeric Grade</p>
                        <p className="text-5xl font-black">{grade.numericGrade.toFixed(1)}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs uppercase tracking-widest opacity-80 mb-2">Grade Points</p>
                        <p className="text-5xl font-black">{grade.gradePoints.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Student & Course Info */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white border-b-2 border-[#4B0082] pb-2">
                        Student Information
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{grade.studentName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Admission No</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{grade.admissionNo}</p>
                        </div>
                        {grade.percentileRank && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Percentile Rank</p>
                            <p className="text-sm font-bold text-gray-900 dark:text-white">
                              {grade.percentileRank.toFixed(0)}th percentile
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white border-b-2 border-[#4B0082] pb-2">
                        Course Information
                      </h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Course Code</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{grade.courseCode}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Course Name</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{grade.courseName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Credits</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">{grade.credits}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Semester</p>
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {grade.semester} {grade.academicYear}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Status & Metadata */}
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Status</span>
                      <span className={`px-3 py-1 text-xs font-black uppercase tracking-widest rounded ${
                        grade.status === 'Finalized' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        grade.status === 'Verified' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400'
                      }`}>
                        {grade.status}
                      </span>
                    </div>
                    {grade.isRetake && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Retake</span>
                        <span className="px-3 py-1 text-xs font-black uppercase tracking-widest rounded bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400">
                          Attempt {grade.retakeAttemptNumber || 1}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Grading Scale</span>
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{grade.gradingScaleType}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Components Tab */}
              {activeTab === 'components' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white border-b-2 border-[#4B0082] pb-2">
                    Assessment Components
                  </h3>
                  
                  {grade.components.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                      No assessment components recorded
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {grade.components.map((component, index) => (
                        <div
                          key={index}
                          className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border-l-4 border-[#4B0082]"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                {component.componentType}
                              </h4>
                              {component.gradedAt && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  Graded: {new Date(component.gradedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span className="text-xs font-black uppercase tracking-widest px-2 py-1 bg-[#4B0082] text-white rounded">
                              {component.weight}%
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500 dark:text-gray-400">Score</span>
                                <span className="font-bold text-gray-900 dark:text-white">
                                  {component.score} / {component.maxScore}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-[#4B0082] h-2 rounded-full transition-all"
                                  style={{ width: `${(component.score / component.maxScore) * 100}%` }}
                                />
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-gray-900 dark:text-white">
                                {((component.score / component.maxScore) * 100).toFixed(1)}%
                              </p>
                            </div>
                          </div>

                          {component.feedback && (
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Feedback</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">{component.feedback}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weighted Calculation Summary */}
                  <div className="bg-[#4B0082]/10 dark:bg-[#4B0082]/20 p-4 rounded-lg border-2 border-[#4B0082]">
                    <h4 className="text-xs font-black uppercase tracking-widest text-gray-900 dark:text-white mb-3">
                      Weighted Calculation
                    </h4>
                    <div className="space-y-2">
                      {grade.components.map((component, index) => (
                        <div key={index} className="flex justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400">
                            {component.componentType} ({component.weight}%)
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {((component.score / component.maxScore) * component.weight).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      <div className="pt-2 border-t-2 border-[#4B0082] flex justify-between">
                        <span className="font-black text-gray-900 dark:text-white">Final Grade</span>
                        <span className="font-black text-gray-900 dark:text-white">
                          {grade.numericGrade.toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white border-b-2 border-[#4B0082] pb-2">
                    Grade History & Audit Trail
                  </h3>
                  
                  <div className="space-y-3">
                    {/* Creation Event */}
                    <div className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <User size={20} className="text-green-600 dark:text-green-400" />
                        </div>
                        <div className="w-0.5 h-full bg-gray-200 dark:bg-gray-700 mt-2"></div>
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">Grade Created</h4>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(grade.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            Created by {grade.createdBy}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Finalization Event */}
                    {grade.finalizedAt && (
                      <div className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                            <Clock size={20} className="text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Grade Finalized</h4>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(grade.finalizedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              Grade locked and made official
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {auditLog.length === 0 && !grade.finalizedAt && (
                      <div className="text-center py-8">
                        <AlertCircle size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-sm text-gray-500 dark:text-gray-400">No additional history available</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500 dark:text-gray-400">Grade not found</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-900 text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GradeDetailsView;









