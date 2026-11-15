/**
 * BMI University Management System - Modern Admission Letter Component
 * Official admission letter with elegant design
 * 100% Open Source - Unique Creative Design
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search, Printer, Download, Mail, ShieldCheck,
  Sparkles, FileText,
  MapPin, Phone, Globe
} from '../shims/lucide-react';
import { PORTAL_URL, MARKETING_URL, ADMISSIONS_EMAIL, PROGRAMS as FALLBACK_PROGRAMS, API_WORKER_URL } from '../services/contracts-bridge';
import { Student } from '../types';
import { documentService } from '../services/documentService';
import { getHtml2Pdf } from '../services/pdfService';
import type { AdmissionLetter as AdmissionLetterType, DocumentSecurityFeatures } from '../types/documents';

const _viteApiUrl = typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined;
const _isDev = false;
const API_BASE = (_viteApiUrl && _viteApiUrl.trim() !== ''
  ? _viteApiUrl
  : (_isDev ? 'http://127.0.0.1:8787' : API_WORKER_URL)
) + '/api';

interface AdmissionLetterProps {
  students: Student[];
  logo: string;
}

const THEME = {
  card: 'bg-white rounded-2xl shadow-xl border border-slate-100',
  input: 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all',
  btnPrimary: 'inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20',
  btnSecondary: 'inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all',
};

export const AdmissionLetter: React.FC<AdmissionLetterProps> = ({ students, logo }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<AdmissionLetterType | null>(null);
  const [securityFeatures, setSecurityFeatures] = useState<DocumentSecurityFeatures | null>(null);

  // ── DB-as-SSOT: hydrate program picker from the canonical /public/programs endpoint.
  //    Fallback ensures the form renders immediately without a live API connection.
  const [programs, setPrograms] = useState(FALLBACK_PROGRAMS);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/public/programs`, { cache: 'force-cache' });
        if (!res.ok) return;
        const body = await res.json();
        if (!body?.success || !Array.isArray(body.data)) return;
        if (cancelled) return;
        setPrograms(body.data.map((p: any) => ({
          label: p.label ?? p.name,
          level: p.level,
          description: p.description,
          icon: p.icon ?? undefined,
        })));
      } catch { /* silently keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const [letterConfig, setLetterConfig] = useState({
    program: programs[0].label, // Default to first program
    faculty: 'School of Science and Technology',
    semester: 'Fall 2024',
    reference: '',
  });

  const getFirstName = (student: Student) => student.first_name || (student as any).firstName as string || '';
  const getLastName = (student: Student) => student.last_name || (student as any).lastName as string || '';
  const getDepartment = (student: Student) => (student as any).department as string || student.program_code;

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchTerm.toLowerCase();
      return `${getFirstName(s)} ${getLastName(s)} ${s.id}`.toLowerCase().includes(q);
    });
  }, [students, searchTerm]);

  const generateLetterData = useCallback(async (student: Student): Promise<{ letter: AdmissionLetterType; security: DocumentSecurityFeatures }> => {
    const letterData: Omit<AdmissionLetterType, 'id' | 'security' | 'createdAt' | 'updatedAt'> = {
      type: 'admission_letter',
      studentId: student.id,
      studentName: `${getFirstName(student)} ${getLastName(student)}`,
      admissionNumber: `ADM-${Date.now().toString().slice(-6)}`,
      academicYear: '2024-2025',
      semester: letterConfig.semester,
      program: letterConfig.program,
      faculty: letterConfig.faculty,
      department: getDepartment(student) || '',
      admissionDate: new Date().toISOString().split('T')[0],
      registrationDeadline: '2025-01-15',
      tuitionFees: 85000,
      currency: 'KES',
      paymentDeadline: '2025-01-10',
      requiredDocuments: ['ID/Passport', 'Academic Certificates', 'Birth Certificate'],
      registrationUrl: `${PORTAL_URL}/register`,
      contactInfo: {
        phone: '+254 700 123 456',
        email: ADMISSIONS_EMAIL,
        address: 'Nairobi, Kenya'
      },
      status: 'draft',
      createdBy: 'admissions'
    };

    const security = await documentService.generateSecurityFeatures('admission_letter', student.id, letterData, {
      includeBlockchain: true
    });

    const letter = await documentService.createDocument<AdmissionLetterType>('admission_letter', student.id, letterData, {
      createdBy: 'admissions'
    });

    return { letter, security };
  }, [letterConfig]);

  const handleGenerate = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    try {
      const { letter, security } = await generateLetterData(selectedStudent);
      setGeneratedLetter(letter);
      setSecurityFeatures(security);
      setShowLetter(true);
    } catch (error) { // eslint-disable-next-line no-console
      console.error('Letter generation failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!generatedLetter) return;
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!generatedLetter) return;
    const element = document.getElementById('modern-admission-letter');
    if (!element) return;

    try {
      const html2pdf = await getHtml2Pdf();

      const opt = {
        margin: 0,
        filename: `ADMISSION_LETTER_${generatedLetter.studentId}_${generatedLetter.studentName.replace(/\s/g, '_')}.pdf`.toUpperCase(),
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) { // eslint-disable-next-line no-console
      console.error('PDF generation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <Mail className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admission Letters</h1>
              <p className="text-slate-500">Generate official admission offer letters</p>
            </div>
          </div>
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            <span className="text-sm text-slate-500">Total Students: </span>
            <span className="font-bold text-slate-900">{students.length}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-6">
        {/* Left Panel */}
        <div className="col-span-5 space-y-6">
          {/* Search */}
          <div className={THEME.card}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Search size={18} className="text-emerald-500" />
                Find Student
              </h3>
            </div>
            <div className="p-4">
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={THEME.input}
              />
            </div>
          </div>

          {/* Student List */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`bg-white rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg border-2 ${selectedStudent?.id === student.id ? 'border-emerald-500 shadow-lg' : 'border-slate-100 hover:border-slate-200'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                    {getFirstName(student)[0]}{getLastName(student)[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{getFirstName(student)} {getLastName(student)}</h4>
                    <p className="text-xs text-slate-500">{student.id} • {getDepartment(student)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Settings */}
          {selectedStudent && (
            <div className={THEME.card}>
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Letter Configuration</h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Program</label>
                  <select
                    value={letterConfig.program}
                    onChange={(e) => setLetterConfig({ ...letterConfig, program: e.target.value })}
                    className={THEME.input}
                  >
                    {programs.map((program) => (
                      <option key={program.label} value={program.label}>
                        {program.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Faculty</label>
                  <select
                    value={letterConfig.faculty}
                    onChange={(e) => setLetterConfig({ ...letterConfig, faculty: e.target.value })}
                    className={THEME.input}
                  >
                    <option>School of Science and Technology</option>
                    <option>School of Business and Economics</option>
                    <option>School of Arts and Humanities</option>
                    <option>School of Engineering</option>
                    <option>School of Health Sciences</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Semester</label>
                  <select
                    value={letterConfig.semester}
                    onChange={(e) => setLetterConfig({ ...letterConfig, semester: e.target.value })}
                    className={THEME.input}
                  >
                    <option>Fall 2024</option>
                    <option>Spring 2025</option>
                    <option>Fall 2025</option>
                  </select>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={`${THEME.btnPrimary} w-full justify-center`}
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      Generate Letter
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="col-span-7">
          {showLetter && generatedLetter && securityFeatures ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">Letter Preview</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handlePrint} className={THEME.btnSecondary}>
                    <Printer size={18} />
                    Print
                  </button>
                  <button onClick={handleDownloadPDF} className={THEME.btnPrimary}>
                    <Download size={18} />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* Letter Document */}
              <div id="modern-admission-letter" className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
                <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

                <div className="p-10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-xl">
                        <img src={logo} alt="BMI" className="w-10 h-10 object-contain brightness-0 invert" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">BMI University</h2>
                        <p className="text-sm text-slate-500 font-medium">Office of Admissions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-lg">
                        <ShieldCheck size={14} />
                        Official Letter
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Ref: {securityFeatures.serialNumber}</p>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-right mb-8">
                    <p className="text-sm text-slate-600">{new Date().toLocaleDateString('en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}</p>
                  </div>

                  {/* Recipient */}
                  <div className="mb-8">
                    <p className="text-sm text-slate-600 mb-1">To:</p>
                    <p className="text-lg font-bold text-slate-900">{generatedLetter.studentName}</p>
                    <p className="text-sm text-slate-600">Student ID: {generatedLetter.studentId}</p>
                    <p className="text-sm text-slate-600">{generatedLetter.department}</p>
                  </div>

                  {/* Subject */}
                  <div className="mb-6">
                    <p className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                      Subject: <span className="text-emerald-700">Offer of Admission</span>
                    </p>
                  </div>

                  {/* Letter Body */}
                  <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-bold text-slate-900">Dear {generatedLetter.studentName.split(' ')[0]},</p>

                    <p>
                      We are delighted to inform you that your application for admission to BMI University has been
                      carefully reviewed, and it is with great pleasure that we offer you a place in our prestigious institution.
                    </p>

                    <div className="bg-emerald-50 rounded-xl p-4 my-6 border-l-4 border-emerald-500">
                      <p className="font-bold text-emerald-900 mb-2">Program Details:</p>
                      <ul className="space-y-1 text-emerald-800">
                        <li><span className="font-semibold">Program:</span> {generatedLetter.program}</li>
                        <li><span className="font-semibold">Faculty:</span> {generatedLetter.faculty}</li>
                        <li><span className="font-semibold">Department:</span> {generatedLetter.department}</li>
                        <li><span className="font-semibold">Semester:</span> {generatedLetter.semester}</li>
                        <li><span className="font-semibold">Academic Year:</span> {generatedLetter.academicYear}</li>
                      </ul>
                    </div>

                    <p>
                      This offer is contingent upon your acceptance and fulfillment of all registration requirements
                      by the specified deadline. We believe that your academic journey at BMI University will be
                      transformative, and we look forward to welcoming you to our vibrant academic community.
                    </p>

                    <p>
                      Please confirm your acceptance of this offer by completing the enclosed acceptance form and
                      returning it along with the required documentation within 30 days of receipt of this letter.
                    </p>

                    <p>
                      Congratulations on this significant achievement. We are excited to have you join us and
                      look forward to supporting your academic and personal growth.
                    </p>
                  </div>

                  {/* Signature */}
                  <div className="mt-10 pt-6 border-t border-slate-200">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-slate-900 font-bold">Yours sincerely,</p>
                        <div className="h-12 border-b border-slate-400 w-48 my-2"></div>
                        <p className="font-bold text-slate-900">Dr. Jane Mwangi</p>
                        <p className="text-sm text-slate-600">Director of Admissions</p>
                        <p className="text-xs text-slate-500">BMI University</p>
                      </div>

                      <div className="text-right">
                        <div className="w-14 h-14 bg-white rounded-lg shadow-md p-1 border border-slate-100 mb-2">
                          <img src={securityFeatures.qrCodeDataUrl} alt="QR" className="w-full h-full" />
                        </div>
                        <p className="text-[10px] text-slate-400">Scan to verify</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t border-slate-200">
                    <div className="flex justify-center gap-6 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><MapPin size={12} /> Nairobi, Kenya</span>
                      <span className="flex items-center gap-1"><Phone size={12} /> +254 700 123 456</span>
                      <span className="flex items-center gap-1"><Globe size={12} /> {MARKETING_URL.replace('https://', '')}</span>
                    </div>
                  </div>
                </div>

                <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />
              </div>
            </div>
          ) : (
            <div className={`${THEME.card} h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center`}>
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <FileText className="text-slate-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Letter Generated</h3>
              <p className="text-slate-500 max-w-md">
                Select a student and configure the admission details to generate an official offer letter.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdmissionLetter;









