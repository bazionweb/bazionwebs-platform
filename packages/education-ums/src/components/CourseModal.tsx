import React, { useState, useEffect } from "react";
import {
  X,
  
  Layers,
  
  
  CheckCircle2,
  Award,
  Info,
  Hash,
} from '../shims/lucide-react';
import { Course } from "../types";

interface CourseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (courseData: Partial<Course>) => void;
  editData?: Course | null;
}

const CourseModal: React.FC<CourseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editData,
}) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [formData, setFormData] = useState<Record<string, any>>({
    title: "",
    code: "",
    faculty: "Theology",
    department: "",
    level: "Undergraduate",
    credit_hours: 3,
    status: "Draft",
    description: "",
    syllabus: "",
  });

  useEffect(() => {
    if (isOpen && editData) {
      setFormData(editData);
    } else if (isOpen) {
      setFormData({
        title: "",
        code: "",
        faculty: "Theology",
        department: "",
        level: "Undergraduate",
        credit_hours: 3,
        status: "Draft",
        description: "",
        syllabus: "",
      });
    }
  }, [isOpen, editData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const faculties = ["Faculty of Theology and Ministry", "Faculty of Christian Education"];
  const levels = ["Undergraduate", "Postgraduate", "Diploma", "Certificate"];
  const statuses = ["Published", "Draft", "Archived"];

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#1a0033]/90 backdrop-blur-3xl p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-4xl max-h-[90vh] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col border-[1px] border-[#FFD700]/30 overflow-hidden animate-slide-up">
        {/* Header Section */}
        <div className="bg-gray-900 text-white p-8 md:p-10 flex flex-col md:flex-row justify-between items-center relative border-b-4 border-[#4B0082]">
          <div className="flex items-center gap-6">
            <div className="bg-white p-2 border-2 border-[#FFD700] shadow-xl">
              <img
                src="/BMI.svg"
                className="w-16 h-16 object-contain"
                alt="BMI Logo"
              />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tighter uppercase leading-none">
                BMI UNIVERSITY
              </h2>
              <p className="text-[10px] font-black text-[#FFD700] uppercase tracking-[0.4em] mt-3">
                Registry of Academic Modules
              </p>
            </div>
          </div>
          <div className="text-right hidden md:block">
            <p className="text-4xl font-black text-white/10 uppercase tracking-tighter select-none absolute top-4 right-20">
              CURRICULUM
            </p>
            <div className="relative z-10 flex flex-col items-end gap-1">
              <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                Protocol: 890-ACAD-SYS
              </span>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">
                {editData
                  ? "Update Institutional Module"
                  : "Digitize New Curriculum"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="absolute top-0 right-0 p-6 hover:bg-red-500 transition-all text-gray-500 hover:text-white"
          >
            <X size={28} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-10 md:p-14 space-y-12 no-scrollbar bg-[#FAFAFA] dark:bg-gray-900"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {/* Section 1: Identifier Metadata */}
            <div className="md:col-span-2 space-y-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-1.5 h-6 bg-[#4B0082]"></div>
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
                  Core Specification
                </h4>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-[#4B0082] dark:text-purple-300 tracking-widest">
                    Course Formal Title
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g. Advanced Systematic Hermeneutics"
                    className="w-full px-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-none text-sm font-black uppercase tracking-tight focus:border-[#4B0082] outline-none shadow-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#4B0082] dark:text-purple-300 tracking-widest">
                      Course Registry Code
                    </label>
                    <div className="relative">
                      <Hash
                        size={16}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        required
                        type="text"
                        value={formData.code}
                        onChange={(e) =>
                          setFormData({ ...formData, code: e.target.value })
                        }
                        placeholder="THEO401"
                        className="w-full pl-12 pr-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-none text-xs font-black uppercase tracking-[0.1em] focus:border-[#4B0082] outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-[#4B0082] dark:text-purple-300 tracking-widest">
                      Credit Magnitude
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      max="10"
                      value={formData.credit_hours}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          credit_hours: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-6 py-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-none text-xl font-black text-emerald-600 focus:border-[#4B0082] outline-none text-center"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Domain Placement */}
            <div className="space-y-8 bg-gray-50 dark:bg-gray-800 p-8 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-2">
                <Layers size={16} className="text-[#FFD700]" />
                <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
                  Institutional Domain
                </h4>
              </div>

              <div className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                    Target Faculty
                  </label>
                  <select
                    value={formData.faculty}
                    onChange={(e) =>
                      setFormData({ ...formData, faculty: e.target.value })
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-[#4B0082] outline-none cursor-pointer"
                  >
                    {faculties.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                    Departmental Node
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    placeholder="e.g. Pedagogy Division"
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-[#4B0082] outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest">
                    Academic Level
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) =>
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      setFormData({ ...formData, level: e.target.value as any })
                    }
                    className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-[10px] font-black uppercase tracking-widest focus:ring-1 focus:ring-[#4B0082] outline-none cursor-pointer"
                  >
                    {levels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-1.5 h-6 bg-[#4B0082]"></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">
                Curriculum Description & Visibility
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="md:col-span-3 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                    Institutional Narrative
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Executive summary of the course..."
                    className="w-full px-6 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-none text-sm font-medium focus:border-[#4B0082] outline-none shadow-inner resize-none"
                  ></textarea>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">
                    Respective Syllabus (Module Breakdown)
                  </label>
                  <textarea
                    rows={8}
                    value={formData.syllabus}
                    onChange={(e) =>
                      setFormData({ ...formData, syllabus: e.target.value })
                    }
                    placeholder="Detailed module content and learning milestones..."
                    className="w-full px-6 py-5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-none text-sm font-medium focus:border-[#4B0082] outline-none shadow-inner resize-none"
                  ></textarea>
                </div>
              </div>
              <div className="space-y-6">
                <div className="p-6 bg-[#4B0082]/5 border border-[#4B0082]/20 space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#4B0082] dark:text-purple-300">
                    Registry Status
                  </p>
                  <div className="space-y-2">
                    {statuses.map((s) => (
                      <label
                        key={s}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <input
                          type="radio"
                          name="status"
                          value={s}
                          checked={formData.status === s}
                          onChange={() =>
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            setFormData({ ...formData, status: s as any })
                          }
                          className="w-4 h-4 accent-[#4B0082]"
                        />
                        <span
                          className={`text-[10px] font-black uppercase tracking-widest ${formData.status === s ? "text-[#4B0082] dark:text-[#FFD700]" : "text-gray-400 group-hover:text-gray-600"}`}
                        >
                          {s}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-gray-900 text-[#FFD700] rounded-none">
                  <Info size={14} />
                  <span className="text-[8px] font-black uppercase tracking-widest">
                    Publically Visible upon Publish
                  </span>
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-10 border-t-2 border-gray-900 bg-white dark:bg-gray-800 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest leading-relaxed max-w-[250px]">
              COMMITTING THIS RECORD UPDATES THE GLOBAL INSTITUTIONAL CATALOG
              AND PREREQUISITE MATRIX AUTOMATICALLY.
            </p>
          </div>

          <div className="flex gap-6 w-full md:w-auto">
            <button
              onClick={onClose}
              className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors py-4 px-6"
            >
              Terminate Entry
            </button>
            <button
              onClick={handleSubmit}
              className="flex-1 md:flex-none px-14 py-5 bg-[#4B0082] text-white rounded-none shadow-2xl font-black uppercase tracking-[0.2em] text-[11px] border border-[#FFD700]/30 hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-3"
            >
              <Award size={18} className="text-[#FFD700]" />
              {editData
                ? "Update Institutional Ledger"
                : "Authorize Curriculum Entry"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseModal;









