import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, User, BookOpen, Calculator } from '../shims/lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GradeData {
  id?: string;
  enrollmentId: string;
  studentName: string;
  admissionNo: string;
  courseCode: string;
  courseName: string;
  cat1Score: number;
  cat2Score: number;
  assignmentScore: number;
  examScore: number;
  remarks?: string;
  academicYear?: string;
  semester?: string;
}

interface AddGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (gradeData: GradeData) => void;
  students: Array<{ id: string; name: string; admissionNo: string }>;
  courses: Array<{ code: string; name: string; fullName?: string }>;
  /** Enrollments for the currently selected course term (keyed by student id → enrollment id) */
  enrollments?: Record<string, string>;
  editData?: GradeData | null;
}

// ── Grade scale (mirrors backend) ─────────────────────────────────────────────

const GRADE_SCALE = [
  { min: 70, letter: 'A',  points: 4.0, color: 'text-emerald-500' },
  { min: 65, letter: 'B+', points: 3.5, color: 'text-green-500'   },
  { min: 60, letter: 'B',  points: 3.0, color: 'text-blue-500'    },
  { min: 55, letter: 'C+', points: 2.5, color: 'text-cyan-500'    },
  { min: 50, letter: 'C',  points: 2.0, color: 'text-yellow-500'  },
  { min: 45, letter: 'D',  points: 1.0, color: 'text-orange-500'  },
  { min: 0,  letter: 'F',  points: 0.0, color: 'text-red-500'     },
];

function computeGrade(total: number) {
  const pct = Math.min(100, Math.max(0, total));
  const row = GRADE_SCALE.find(g => pct >= g.min) ?? GRADE_SCALE[GRADE_SCALE.length - 1];
  return { pct, ...row };
}

// ── Score input sub-component ─────────────────────────────────────────────────

interface ScoreInputProps {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  error?: string;
}
function ScoreInput({ label, value, max, onChange, error }: ScoreInputProps) {
  return (
    <div className="space-y-1">
      <label className="flex items-center justify-between text-xs font-semibold text-gray-600 dark:text-gray-400">
        <span>{label}</span>
        <span className="text-[10px] text-gray-400">/{max}</span>
      </label>
      <input
        type="number"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={e => {
          const v = parseFloat(e.target.value);
          onChange(isNaN(v) ? 0 : Math.min(max, Math.max(0, v)));
        }}
        className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm font-bold outline-none
          focus:border-purple-500 dark:text-white transition-colors ${error ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
        placeholder="0"
      />
      {error && <p className="text-[10px] text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

const EMPTY: Omit<GradeData, 'enrollmentId'> & { enrollmentId: string } = {
  enrollmentId: '',
  studentName: '',
  admissionNo: '',
  courseCode: '',
  courseName: '',
  cat1Score: 0,
  cat2Score: 0,
  assignmentScore: 0,
  examScore: 0,
  remarks: '',
  academicYear: new Date().getFullYear().toString(),
  semester: 'Semester 1',
};

const AddGradeModal: React.FC<AddGradeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  students,
  courses,
  enrollments = {},
  editData,
}) => {
  const [form, setForm] = useState<GradeData>({ ...EMPTY });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setForm(editData ? { ...editData } : { ...EMPTY });
    setErrors({});
  }, [editData, isOpen]);

  const set = useCallback(<K extends keyof GradeData>(key: K, value: GradeData[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
  }, []);

  // Auto-fill name/admissionNo when student selected via enrollmentId
  const handleStudentChange = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      const enrollmentId = enrollments[studentId] ?? '';
      setForm(prev => ({
        ...prev,
        enrollmentId,
        studentName: student.name,
        admissionNo: student.admissionNo,
      }));
    }
  };

  const handleCourseChange = (code: string) => {
    const course = courses.find(c => c.code === code);
    if (course) {
      setForm(prev => ({ ...prev, courseCode: code, courseName: course.fullName ?? course.name }));
    }
  };

  const totalScore = form.cat1Score + form.cat2Score + form.assignmentScore + form.examScore;
  const gradeInfo = computeGrade(totalScore);

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.enrollmentId && !editData?.enrollmentId) errs.student = 'Select a student (enrollment required)';
    if (!form.courseCode) errs.course = 'Course is required';
    if (form.examScore < 0 || form.examScore > 100) errs.examScore = 'Exam score must be 0–100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Strip any stray percentage before sending to parent – parent calls API
    const { ...payload } = form;
    onSave(payload as GradeData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl border border-purple-100 dark:border-gray-700">

        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-[#4B0082] to-[#7B1FA2] text-white p-5 flex justify-between items-center rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {editData ? 'Edit Grade Entry' : 'Submit Grade Entry'}
            </h2>
            <p className="text-[10px] text-purple-200 uppercase tracking-widest mt-0.5">
              Component-Based Assessment · No manual percentage entry
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Student */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
              <User size={13} className="text-purple-600" />
              Student *
            </label>
            <select
              value={students.find(s => s.name === form.studentName)?.id ?? ''}
              onChange={e => handleStudentChange(e.target.value)}
              disabled={!!editData}
              className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm font-medium outline-none focus:border-purple-500 dark:text-white transition-colors ${errors.student ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <option value="">— Select Student —</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.admissionNo} · {s.name}</option>
              ))}
            </select>
            {errors.student && <p className="text-[10px] text-red-500 font-medium">{errors.student}</p>}
          </div>

          {/* Course */}
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
              <BookOpen size={13} className="text-purple-600" />
              Course *
            </label>
            <select
              value={form.courseCode}
              onChange={e => handleCourseChange(e.target.value)}
              disabled={!!editData}
              className={`w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 rounded-lg text-sm font-medium outline-none focus:border-purple-500 dark:text-white transition-colors ${errors.course ? 'border-red-400' : 'border-gray-200 dark:border-gray-600'}`}
            >
              <option value="">— Select Course —</option>
              {courses.map(c => (
                <option key={c.code} value={c.code}>{c.code} · {c.fullName ?? c.name}</option>
              ))}
            </select>
            {errors.course && <p className="text-[10px] text-red-500 font-medium">{errors.course}</p>}
          </div>

          {/* Score Components */}
          <div>
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400 mb-3">
              <Calculator size={13} className="text-purple-600" />
              Assessment Scores
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ScoreInput label="CAT 1" value={form.cat1Score} max={25}
                onChange={v => set('cat1Score', v)} error={errors.cat1Score} />
              <ScoreInput label="CAT 2" value={form.cat2Score} max={25}
                onChange={v => set('cat2Score', v)} error={errors.cat2Score} />
              <ScoreInput label="Assignment" value={form.assignmentScore} max={10}
                onChange={v => set('assignmentScore', v)} error={errors.assignmentScore} />
              <ScoreInput label="Final Exam" value={form.examScore} max={40}
                onChange={v => set('examScore', v)} error={errors.examScore} />
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
              CAT 1 (25) + CAT 2 (25) + Assignment (10) + Exam (40) = 100 pts
            </p>
          </div>

          {/* Live Grade Preview */}
          <div className="flex items-center gap-5 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-100 dark:border-purple-800">
            <div className="flex flex-col items-center">
              <span className={`text-4xl font-black ${gradeInfo.color}`}>{gradeInfo.letter}</span>
              <span className="text-[10px] text-gray-500 mt-0.5">Letter</span>
            </div>
            <div className="h-10 w-px bg-purple-200 dark:bg-purple-700" />
            <div className="flex-1 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Total Score</span>
                <span className="text-xl font-bold dark:text-white">{totalScore.toFixed(1)} / 100</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400 block font-medium">Grade Points</span>
                <span className="text-xl font-bold dark:text-white">{gradeInfo.points.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Academic Year & Semester */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
                Academic Year
              </label>
              <input
                type="text"
                value={form.academicYear ?? ''}
                onChange={e => set('academicYear', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium outline-none focus:border-purple-500 dark:text-white"
                placeholder="2025/2026"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
                Semester
              </label>
              <select
                value={form.semester ?? 'Semester 1'}
                onChange={e => set('semester', e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium outline-none focus:border-purple-500 dark:text-white"
              >
                <option value="Semester 1">Semester 1</option>
                <option value="Semester 2">Semester 2</option>
                <option value="Trimester 1">Trimester 1</option>
                <option value="Trimester 2">Trimester 2</option>
                <option value="Trimester 3">Trimester 3</option>
              </select>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-600 dark:text-gray-400">
              Remarks (optional)
            </label>
            <textarea
              value={form.remarks ?? ''}
              onChange={e => set('remarks', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 rounded-lg text-sm outline-none focus:border-purple-500 dark:text-white resize-none"
              placeholder="Any remarks about student performance…"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-[#4B0082] to-[#7B1FA2] text-white font-semibold text-sm rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Save size={15} />
              {editData ? 'Update Grade' : 'Submit Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGradeModal;









