/* eslint-disable */
/**
 * BMI UMS — Student Portal
 * Modern, widget-based dashboard with TanStack Query and Privacy Mode.
 */
import React, { useState } from 'react';
import {
  GraduationCap, BookOpen, DollarSign,
  TrendingUp, CheckCircle, AlertCircle,
  Settings, FileText, EyeOff, Eye, Clock, Calendar
} from '../shims/lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useGradesQuery, useTransactionsQuery } from '../hooks/useEntityQueries';
import ProfileModal from './ProfileModal';
import DocumentRequestModal from './DocumentRequestModal';

const StudentPortal: React.FC = () => {
  const user = useAuthStore((s) => s.user);

  // TanStack Query hooks for reliable, cached data fetching
  const { data: gradesData, isLoading: loadingGrades, error: gradesError } = useGradesQuery({ perPage: 50 });
  const { data: txData, isLoading: loadingTx, error: txError } = useTransactionsQuery({ perPage: 200 });

  // Privacy Mode Toggle
  const [privacyMode, setPrivacyMode] = useState(false);

  // Modal states
  const [showProfile, setShowProfile] = useState(false);
  const [showDocRequest, setShowDocRequest] = useState(false);

  // Derived Data
  const grades = gradesData?.data?.items || [];
  const transactions = txData?.data || [];
  
  const gpa = grades.length
    ? (grades.reduce((s: number, g: any) => s + (g.gpa ?? g.gradePoint ?? 0), 0) / grades.length).toFixed(2)
    : '—';

  const paid = transactions.filter((t: any) => t.status === 'Paid').reduce((s: number, t: any) => s + t.amt, 0);
  const pending = transactions.filter((t: any) => t.status === 'Pending').reduce((s: number, t: any) => s + t.amt, 0);

  const isLoading = loadingGrades || loadingTx;
  const hasError = gradesError || txError;

  return (
    <div className="h-full flex flex-col bg-[#F8F9FA] dark:bg-black overflow-hidden animate-fade-in">
      {/* ── Top App Bar ── */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-800 px-6 py-4 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="pl-14 md:pl-10 lg:pl-0">
          <h1 className="text-xl font-black text-[#2E004F] dark:text-white uppercase tracking-tight">
            Student Portal
          </h1>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-widest flex items-center gap-2">
            <span>{user?.name}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
            <span>{user?.email}</span>
          </p>
        </div>
        
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Privacy Toggle */}
          <button 
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              privacyMode 
                ? 'bg-purple-100 text-[#4B0082] dark:bg-purple-900/30 dark:text-purple-300' 
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
            }`}
          >
            {privacyMode ? <EyeOff size={14} /> : <Eye size={14} />}
            <span className="hidden sm:inline">Privacy Mode</span>
          </button>

          {/* Quick Actions */}
          <button 
            onClick={() => setShowDocRequest(true)}
            className="flex-1 md:flex-none flex justify-center items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <FileText size={14} className="text-[#4B0082]" />
            <span className="hidden sm:inline">Documents</span>
          </button>
          
          <button 
            onClick={() => setShowProfile(true)}
            className="flex justify-center items-center p-2 bg-[#4B0082] rounded-xl text-white hover:bg-black transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <Settings size={18} className="text-[#FFD700]" />
          </button>
        </div>
      </div>

      {/* ── Main Dashboard Scroll Area ── */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
          
          {hasError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-start gap-3 shadow-sm">
              <AlertCircle size={18} className="mt-0.5 shrink-0" /> 
              <div>
                <p className="font-bold">Error loading data</p>
                <p className="text-red-600 text-xs">There was a problem fetching your records. Please refresh the page.</p>
              </div>
            </div>
          )}

          {/* ── Widgets Grid ── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            
            {/* Left Column (Academic & Financial Overview) */}
            <div className="md:col-span-8 space-y-6">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-transparent dark:from-purple-900/20 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                      <TrendingUp size={18} className="text-[#4B0082] dark:text-purple-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Cumulative GPA</p>
                  </div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">
                    {privacyMode ? '••••' : gpa}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-transparent dark:from-blue-900/20 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <BookOpen size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Courses Passed</p>
                  </div>
                  <p className="text-3xl font-black text-gray-900 dark:text-white">
                    {privacyMode ? '••' : grades.length}
                  </p>
                </div>
                
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-transparent dark:from-emerald-900/20 rounded-bl-full opacity-50 group-hover:scale-110 transition-transform"></div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                      <DollarSign size={18} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Fee Balance</p>
                  </div>
                  <p className={`text-3xl font-black ${pending > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {privacyMode ? '••••••' : `$${pending.toLocaleString()}`}
                  </p>
                </div>
              </div>

              {/* Academic Record Widget */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/20">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                      <GraduationCap size={16} className="text-[#4B0082] dark:text-purple-400" />
                    </div>
                    <h2 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white">
                      Recent Grades
                    </h2>
                  </div>
                  <button className="text-[10px] font-bold uppercase tracking-widest text-[#4B0082] hover:underline">View Full Transcript</button>
                </div>

                <div className="overflow-x-auto">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="w-8 h-8 border-4 border-purple-100 border-t-[#4B0082] rounded-full animate-spin" />
                      <p className="text-xs text-gray-400 font-medium animate-pulse">Syncing records...</p>
                    </div>
                  ) : grades.length === 0 ? (
                    <div className="py-16 flex flex-col items-center text-center">
                      <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                        <BookOpen size={24} className="text-gray-300" />
                      </div>
                      <p className="text-gray-500 font-medium">No grade records found.</p>
                      <p className="text-xs text-gray-400 mt-1">Check back after the examination period.</p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                        <tr>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Course</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 hidden sm:table-cell">Term</th>
                          <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                        {grades.slice(0, 5).map((g: any) => (
                          <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-gray-900 dark:text-gray-100">{g.courseTitle || g.courseCode}</p>
                              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{g.courseCode}</p>
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-medium">
                                <Calendar size={12} /> {g.semester} {g.academicYear}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {privacyMode ? (
                                <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 animate-pulse ml-auto"></div>
                              ) : (
                                <div className="flex flex-col items-end">
                                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-black shadow-sm ${
                                    g.grade?.startsWith('A') ? 'bg-emerald-100 text-emerald-700'
                                    : g.grade?.startsWith('B') ? 'bg-blue-100 text-blue-700'
                                    : g.grade?.startsWith('C') ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                  }`}>
                                    {g.grade ?? '—'}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-400 mt-1">{g.totalScore ?? '—'}%</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (Widgets) */}
            <div className="md:col-span-4 space-y-6">
              
              {/* Financial Status Widget */}
              <div className="bg-gradient-to-br from-[#4B0082] to-[#2E004F] rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FFD700] rounded-full mix-blend-overlay opacity-20 blur-2xl"></div>
                
                <h3 className="font-black text-[10px] uppercase tracking-widest text-purple-200 mb-6 flex items-center gap-2">
                  <DollarSign size={14} /> Financial Status
                </h3>
                
                <div className="space-y-4 relative z-10">
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200 mb-1">Total Paid</p>
                    <p className="text-xl font-black">
                      {privacyMode ? '••••••' : `$${paid.toLocaleString()}`}
                    </p>
                  </div>
                  
                  <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-200 mb-1">Outstanding Balance</p>
                    <p className={`text-2xl font-black ${pending > 0 ? 'text-[#FFD700]' : 'text-emerald-400'}`}>
                      {privacyMode ? '••••••' : `$${pending.toLocaleString()}`}
                    </p>
                  </div>
                </div>

                {pending === 0 ? (
                  <div className="mt-5 flex items-center gap-2 text-emerald-300 text-xs font-bold bg-emerald-900/30 py-2 px-3 rounded-lg border border-emerald-500/20">
                    <CheckCircle size={14} /> Account is clear
                  </div>
                ) : (
                  <button className="mt-5 w-full py-2.5 bg-[#FFD700] text-[#4B0082] font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 transition-all shadow-md">
                    Make Payment
                  </button>
                )}
              </div>

              {/* Announcements Widget */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                  <Clock size={14} /> Upcoming Deadlines
                </h3>
                <div className="space-y-4">
                  <div className="flex gap-3 items-start p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse"></div>
                    <div>
                      <p className="text-xs font-bold text-red-800 dark:text-red-400">Course Registration Closes</p>
                      <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5">Tomorrow at 11:59 PM</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-1.5 shrink-0"></div>
                    <div>
                      <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Final Exam Schedule Published</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">In 14 days</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      <ProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />
      <DocumentRequestModal isOpen={showDocRequest} onClose={() => setShowDocRequest(false)} />
    </div>
  );
};

export default StudentPortal;









