/**
 * BMI UMS — Faculty Portal
 * Self-service view for role === 'faculty'
 * Shows assigned courses and a quick grade entry form.
 */
import React, { useState } from 'react';
import {
  BookOpen, Users, Award, PenLine, CheckCircle, AlertCircle, Loader2,
} from '../shims/lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useDataStore } from '../stores/dataStore';
import { createAcademicRecord } from '../services/academicRecordsService';

interface GradeEntry {
  studentId: string;
  courseCode: string;
  percentage: number;
  academicYear: string;
  semester: 'Fall' | 'Spring' | 'Summer';
}

const CURRENT_YEAR = `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`;

const FacultyPortal: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const courses = useDataStore((s) => s.courses);
  const students = useDataStore((s) => s.students);

  const [form, setForm] = useState<GradeEntry>({
    studentId: '',
    courseCode: '',
    percentage: 0,
    academicYear: CURRENT_YEAR,
    semester: 'Fall',
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId || !form.courseCode) {
      showToast('error', 'Please select a student and a course.');
      return;
    }
    setSubmitting(true);
    try {
      await createAcademicRecord({
        student_id: form.studentId,
        course_id: form.courseCode,
        total_score: form.percentage,
        academic_year: form.academicYear,
      });
      showToast('success', 'Grade saved successfully.');
      setForm(f => ({ ...f, studentId: '', percentage: 0 }));
    } catch (error: unknown) {
      showToast('error', error instanceof Error ? error.message : 'Failed to save grade.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-6 py-3 shadow-sm">
        <div className="pl-14">
          <h1 className="text-lg font-black text-[#2E004F] dark:text-white uppercase tracking-tighter">
            Faculty Portal
          </h1>
          <p className="text-[9px] font-bold text-gray-500 dark:text-gray-400 mt-0.5 uppercase tracking-widest">
            {user?.name} · Grade Entry &amp; Course Management
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-none">
              <BookOpen size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Courses Available</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{courses.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-none">
              <Users size={22} className="text-[#4B0082]" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Students</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white">{students.length}</p>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-none">
              <Award size={22} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Semester</p>
              <p className="text-base font-black text-gray-900 dark:text-white">{form.semester} {form.academicYear.split('-')[0]}</p>
            </div>
          </div>
        </div>

        {/* Grade entry form */}
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <PenLine size={16} className="text-[#4B0082]" />
            <h2 className="font-black text-xs uppercase tracking-widest text-gray-900 dark:text-white">
              Quick Grade Entry
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Student</label>
              <select
                required
                value={form.studentId}
                onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-[#4B0082] dark:text-white"
              >
                <option value="">— Select Student —</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || `${s.first_name} ${s.last_name}`} ({s.reg_no})
                  </option>
                ))}
              </select>
            </div>

            {/* Course */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Course</label>
              <select
                required
                value={form.courseCode}
                onChange={e => setForm(f => ({ ...f, courseCode: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-[#4B0082] dark:text-white"
              >
                <option value="">— Select Course —</option>
                {courses.map(c => (
                  <option key={c.id} value={c.code}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Score */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Score (%) — 0 to 100
              </label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={form.percentage}
                onChange={e => setForm(f => ({ ...f, percentage: Math.min(100, Math.max(0, Number(e.target.value))) }))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-[#4B0082] dark:text-white"
              />
            </div>

            {/* Semester */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Semester</label>
              <select
                value={form.semester}
                onChange={e => setForm(f => ({ ...f, semester: e.target.value as 'Fall'|'Spring'|'Summer' }))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-[#4B0082] dark:text-white"
              >
                <option>Fall</option>
                <option>Spring</option>
                <option>Summer</option>
              </select>
            </div>

            {/* Academic year */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Academic Year</label>
              <input
                type="text"
                pattern="\d{4}-\d{4}"
                placeholder="e.g. 2024-2025"
                value={form.academicYear}
                onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))}
                className="w-full p-2.5 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 outline-none text-xs font-semibold focus:ring-1 focus:ring-[#4B0082] dark:text-white"
              />
            </div>

            {/* Submit */}
            <div className="md:col-span-2 flex justify-end pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-2.5 bg-[#4B0082] text-white text-xs font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                {submitting ? 'Saving...' : 'Save Grade'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] px-8 py-4 shadow-2xl flex items-center gap-3 text-xs font-black uppercase tracking-wider ${
          toast.type === 'success' ? 'bg-gray-900 text-[#FFD700] border-2 border-[#FFD700]' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default FacultyPortal;









