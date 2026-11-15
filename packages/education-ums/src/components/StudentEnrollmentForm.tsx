import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, User, BookOpen, Hash } from '../shims/lucide-react';
import { createEnrollment, getPrograms, getAcademicTerms, getProgramById } from '../services/programService';
import { Program, AcademicTerm } from '../types';
import { useTranslation } from '../shims/react-i18next';

// Local types
interface Student {
  id: string;
  name: string;
  regNo: string;
}

interface EnrollmentData {
  student_id: string;
  course_id: string;
  program_id: string;
  term_id: string;
  academic_year?: string;
  semester_number?: number;
  status?: string;
}

interface StudentEnrollmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (enrollment: unknown) => void;
  students: Student[];
}

const StudentEnrollmentForm: React.FC<StudentEnrollmentFormProps> = ({ isOpen, onClose, onSuccess, students }) => {
  const { t } = useTranslation();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [courses, setCourses] = useState<unknown[]>([]);
  const [form, setForm] = useState<EnrollmentData>({
    student_id: '',
    course_id: '',
    program_id: '',
    term_id: '',
    academic_year: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    semester_number: 1,
    status: 'enrolled',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load lookup data when modal opens
  useEffect(() => {
    if (isOpen) {
      getPrograms().then(res => {
        if (res.success) setPrograms(res.data || []);
      });
      getAcademicTerms().then(res => {
        if (res.success) setTerms(res.data || []);
      });
    }
  }, [isOpen]);

  // Fetch courses when selected program changes
  useEffect(() => {
    if (form.program_id) {
      getProgramById(form.program_id).then(res => {
        if (res.success && res.data && res.data.courses) {
          setCourses(res.data.courses);
        } else {
          setCourses([]);
        }
      });
    } else {
      setCourses([]);
    }
    // Reset course choice when program changes
    setForm(prev => ({ ...prev, course_id: '' }));
  }, [form.program_id]);

  const set = useCallback(<K extends keyof EnrollmentData>(key: K, value: EnrollmentData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.student_id) errs.student_id = 'Select a student';
    if (!form.program_id) errs.program_id = 'Select a program';
    if (!form.course_id && form.program_id) errs.course_id = 'Select a course';
    if (!form.term_id) errs.term_id = 'Select an academic term';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const result = await createEnrollment(form);
    if (result.success) {
      onSuccess?.(result.data);
      onClose();
    } else {
      alert('Failed to create enrollment');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl border border-purple-100 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#4B0082] to-[#7B1FA2] text-white p-5 flex justify-between items-center rounded-t-2xl">
          <h2 className="text-lg font-bold">Enroll Student</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Student */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">
              <User size={14} className="text-purple-600" /> Student *</label>
            <select
              value={form.student_id}
              onChange={e => set('student_id', e.target.value)}
              className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm outline-none focus:border-purple-500 ${errors.student_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <option value="">— Select Student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.regNo} · {s.name}</option>
              ))}
            </select>
            {errors.student_id && <p className="text-xs text-red-500 mt-1">{errors.student_id}</p>}
          </div>
          {/* Program */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">
              <BookOpen size={14} className="text-purple-600" /> {t('academic.program')} *</label>
            <select
              value={form.program_id}
              onChange={e => set('program_id', e.target.value)}
              className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm outline-none focus:border-purple-500 ${errors.program_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <option value="">— Select {t('academic.program')} —</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.code} · {p.name}</option>
              ))}
            </select>
            {errors.program_id && <p className="text-xs text-red-500 mt-1">{errors.program_id}</p>}
          </div>
          {/* Course selector (visible only after selecting a program) */}
          {form.program_id && (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">
                <BookOpen size={14} className="text-purple-600" /> Course *</label>
              <select
                value={form.course_id}
                onChange={e => set('course_id', e.target.value)}
                className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm outline-none focus:border-purple-500 ${errors.course_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
              >
                <option value="">— Select Course —</option>
                {(courses as any[]).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.code} · {c.title}</option>
                ))}
              </select>
              {errors.course_id && <p className="text-xs text-red-500 mt-1">{errors.course_id}</p>}
            </div>
          )}
          {/* Academic Term */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold uppercase text-gray-600 dark:text-gray-400">
              <Hash size={14} className="text-purple-600" /> Academic Term *</label>
            <select
              value={form.term_id}
              onChange={e => set('term_id', e.target.value)}
              className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm outline-none focus:border-purple-500 ${errors.term_id ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <option value="">— Select Term —</option>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.academic_year} · Sem {t.semester_number} ({t.status})</option>
              ))}
            </select>
            {errors.term_id && <p className="text-xs text-red-500 mt-1">{errors.term_id}</p>}
          </div>
          {/* Academic Year */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Academic Year</label>
            <input
              type="text"
              value={form.academic_year ?? ''}
              onChange={e => set('academic_year', e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:border-purple-500"
              placeholder="2025/2026"
            />
          </div>
          {/* Semester Number */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase text-gray-600 dark:text-gray-400">Semester Number</label>
            <input
              type="number"
              min="1"
              max="3"
              value={form.semester_number ?? 1}
              onChange={e => set('semester_number', Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:border-purple-500"
            />
          </div>
          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button type="button" onClick={onClose} className="flex-1 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all">
              Cancel
            </button>
            <button type="submit" className="flex-1 px-5 py-2.5 bg-gradient-to-r from-[#4B0082] to-[#7B1FA2] text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2">
              <Save size={15} /> Enroll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentEnrollmentForm;









