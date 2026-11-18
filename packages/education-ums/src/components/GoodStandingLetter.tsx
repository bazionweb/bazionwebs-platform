/**
 * BMI University Management System - Modern Good Standing Letter Component
 * Official letter certifying student status with elegant design
 * 100% Open Source - Unique Creative Design
 */

import React, { useState, useMemo, useCallback } from 'react';
import { 
  Search, Printer, Download, Shield, ShieldCheck, 
  Sparkles, Award
} from '../shims/lucide-react';
import { MARKETING_URL_WWW } from '../services/contracts-bridge';
import { Student } from '../types';
import { documentService } from '../services/documentService';
import { getHtml2Pdf } from '../services/pdfService';
import type { GoodStandingLetter as GoodStandingLetterType, DocumentSecurityFeatures } from '../types/documents';
import { useUIStore } from '../stores/uiStore';

interface GoodStandingLetterProps {
  students: Student[];
  logo: string;
}

const THEME = {
  card: 'bg-white rounded-2xl shadow-xl border border-slate-100',
  input: 'w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all',
  btnPrimary: 'inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20',
  btnSecondary: 'inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all',
};

export const GoodStandingLetter: React.FC<GoodStandingLetterProps> = ({ students, logo }) => {
  const institutionName = useUIStore((state) => state.institutionName);
  const shortName = useUIStore((state) => state.shortName);
  const configuredLogo = useUIStore((state) => state.logo);
  const primaryColor = useUIStore((state) => state.primaryColor);
  const accentColor = useUIStore((state) => state.accentColor);
  const documentLogo = logo || configuredLogo;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showLetter, setShowLetter] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<GoodStandingLetterType | null>(null);
  const [securityFeatures, setSecurityFeatures] = useState<DocumentSecurityFeatures | null>(null);
  const [letterConfig, setLetterConfig] = useState({
    letterType: 'employment' as 'general' | 'transfer' | 'employment' | 'scholarship' | 'visa',
    purpose: 'Employment Application',
  });

  const getFirstName = (student: Student) => student.first_name || (student as any).firstName as string || '';
  const getLastName = (student: Student) => student.last_name || (student as any).lastName as string || '';
  const getProgram = (student: Student) => student.program_code || (student as any).program as string || '';

  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = searchTerm.toLowerCase();
      return `${getFirstName(s)} ${getLastName(s)} ${s.id}`.toLowerCase().includes(q);
    });
  }, [students, searchTerm]);

  const generateLetterData = useCallback(async (student: Student): Promise<{ letter: GoodStandingLetterType; security: DocumentSecurityFeatures }> => {
    const letterData: Omit<GoodStandingLetterType, 'id' | 'security' | 'createdAt' | 'updatedAt'> = {
      type: 'good_standing',
      studentId: student.id,
      studentName: `${getFirstName(student)} ${getLastName(student)}`,
      letterType: letterConfig.letterType,
      purpose: letterConfig.purpose,
      academicStatus: 'Good Standing',
      conductStatus: 'Satisfactory',
      financialStatus: 'Cleared',
      effectiveDate: new Date().toISOString().split('T')[0],
      letterBody: `This letter certifies that ${getFirstName(student)} ${getLastName(student)} is a student in good standing at ${institutionName}.`,
      authorizedBy: 'Dr. Michael Ochieng',
      authorizedTitle: 'University Registrar',
      status: 'draft',
      createdBy: 'registrar'
    };

    const security = await documentService.generateSecurityFeatures('good_standing', student.id, letterData, {
      includeBlockchain: true
    });

    const letter = await documentService.createDocument<GoodStandingLetterType>('good_standing', student.id, letterData, {
      createdBy: 'registrar'
    });

    return { letter, security };
  }, [letterConfig, institutionName]);

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
    const element = document.getElementById('modern-standing-letter');
    if (!element) return;

    try {
      const html2pdf = await getHtml2Pdf();
      
      const opt = {
        margin: 0,
        filename: `GOOD_STANDING_${generatedLetter.studentId}_${generatedLetter.studentName.replace(/\s/g, '_')}.pdf`.toUpperCase(),
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-cyan-50/30 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center shadow-xl shadow-cyan-500/20">
              <Shield className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Good Standing Letters</h1>
              <p className="text-slate-500">Certify student academic and disciplinary standing</p>
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
                <Search size={18} className="text-cyan-500" />
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
          <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                onClick={() => setSelectedStudent(student)}
                className={`bg-white rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg border-2 ${
                  selectedStudent?.id === student.id ? 'border-cyan-500 shadow-lg' : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                    {getFirstName(student)[0]}{getLastName(student)[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">{getFirstName(student)} {getLastName(student)}</h4>
                    <p className="text-xs text-slate-500">{student.id} • {getProgram(student)}</p>
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Standing Type</label>
                  <select
                    value={letterConfig.letterType}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(e) => setLetterConfig({ ...letterConfig, letterType: e.target.value as any })}
                    className={THEME.input}
                  >
                    <option value="general">General Purpose</option>
                    <option value="employment">Employment</option>
                    <option value="scholarship">Scholarship</option>
                    <option value="visa">Visa Application</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Purpose</label>
                  <select
                    value={letterConfig.purpose}
                    onChange={(e) => setLetterConfig({ ...letterConfig, purpose: e.target.value })}
                    className={THEME.input}
                  >
                    <option>Employment Application</option>
                    <option>Scholarship Application</option>
                    <option>Visa Application</option>
                    <option>Further Studies</option>
                    <option>Professional Registration</option>
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
              <div id="modern-standing-letter" className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200" style={{ "--institution-primary": primaryColor, "--institution-accent": accentColor } as React.CSSProperties}>
                <div className="h-2" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor}, ${primaryColor})` }} />
                
                <div className="p-10">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-8 pb-6 border-b-2 border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center shadow-xl">
                        <img src={documentLogo} alt={shortName} className="w-10 h-10 object-contain brightness-0 invert" />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight">{institutionName}</h2>
                        <p className="text-sm text-slate-500 font-medium">Office of the Registrar</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white font-bold text-xs shadow-lg" style={{ backgroundColor: primaryColor }}>
                        <ShieldCheck size={14} />
                        Official Certification
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Ref: {securityFeatures.serialNumber}</p>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="text-center mb-8">
                      <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl border" style={{ backgroundColor: `${accentColor}14`, borderColor: `${accentColor}66` }}>
                      <Award style={{ color: primaryColor }} size={28} />
                      <div className="text-left">
                        <h1 className="text-2xl font-black text-slate-900">CERTIFICATE OF GOOD STANDING</h1>
                        <p className="text-sm font-medium" style={{ color: primaryColor }}>{generatedLetter.standingType} Verification</p>
                      </div>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="text-right mb-6">
                    <p className="text-sm text-slate-600">{new Date().toLocaleDateString('en-US', { 
                      year: 'numeric', month: 'long', day: 'numeric' 
                    })}</p>
                  </div>

                  {/* Letter Body */}
                  <div className="space-y-4 text-slate-700 leading-relaxed">
                    <p className="font-bold text-slate-900">TO WHOM IT MAY CONCERN,</p>
                    
                    <p>
                      This is to certify that <span className="font-bold text-slate-900">{generatedLetter.studentName}</span>, 
                      Student ID Number <span className="font-mono font-bold">{generatedLetter.studentId}</span>, 
                      is a registered student at {institutionName} and is currently in 
                      <span className="font-bold" style={{ color: primaryColor }}> GOOD STANDING</span> in all respects.
                    </p>

                    <div className="bg-slate-50 rounded-xl p-5 my-6 border-l-4 border-cyan-500">
                      <p className="font-bold text-slate-900 mb-3">Letter Information:</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-slate-500">Letter Type:</span> <span className="font-semibold text-slate-800">{generatedLetter.letterType}</span></div>
                        <div><span className="text-slate-500">Purpose:</span> <span className="font-semibold text-slate-800">{generatedLetter.purpose}</span></div>
                      </div>
                    </div>

                    <p>
                      This certification is issued for the purpose of <span className="font-semibold">{generatedLetter.purpose}</span>. 
                      The student has met all requirements and maintains {generatedLetter.academicStatus.toLowerCase()} 
                      at the institution.
                    </p>

                    <p>
                      This letter may be verified using the QR code or reference number provided below.
                    </p>
                  </div>

                  {/* Signature */}
                  <div className="mt-10 pt-6 border-t border-slate-200">
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-slate-900 font-bold">Yours faithfully,</p>
                        <div className="h-12 border-b border-slate-400 w-48 my-2"></div>
                        <p className="font-bold text-slate-900">Dr. Michael Ochieng</p>
                        <p className="text-sm text-slate-600">University Registrar</p>
                        <p className="text-xs text-slate-500">{institutionName}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="w-16 h-16 bg-white rounded-lg shadow-md p-1 border border-slate-100 mb-2">
                          <img src={securityFeatures.qrCodeDataUrl} alt="QR" className="w-full h-full" />
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">{securityFeatures.serialNumber}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-8 pt-4 border-t border-slate-200">
                    <p className="text-[10px] text-slate-400 text-center">
                      This is an official document issued by {institutionName}. The authenticity of this document can be verified 
                      by scanning the QR code above or visiting {MARKETING_URL_WWW.replace('https://', '')}/verify and entering the reference number.
                    </p>
                  </div>
                </div>
                
                <div className="h-2" style={{ background: `linear-gradient(90deg, ${primaryColor}, ${accentColor}, ${primaryColor})` }} />
              </div>
            </div>
          ) : (
            <div className={`${THEME.card} h-full min-h-[500px] flex flex-col items-center justify-center p-12 text-center`}>
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Shield className="text-slate-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Letter Generated</h3>
              <p className="text-slate-500 max-w-md">
                Select a student and configure the standing certification details to generate an official letter.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoodStandingLetter;









