/**
 * BMI University Management System - Modern ID Card Component
 * Secure student identification card with elegant design
 * 100% Open Source - Unique Creative Design
 */

import React, { useState, useMemo, useCallback } from "react";
import { PLATFORM_BRAND_MARK_URL } from "./PlatformBrandBadge";
import {
  Search,
  
  Download,
  
  User,
  CreditCard,
  
  
  
  
  
  Sparkles,
  
  Fingerprint,
  
  
  IdCardIcon,
} from '../shims/lucide-react';
import { Student } from "../types";
import { documentService } from "../services/documentService";
import { getHtml2Pdf } from "../services/pdfService";
import { useUIStore } from "../stores/uiStore";
import type {
  StudentIDCard as StudentIDCardType,
  DocumentSecurityFeatures,
  DocumentStatus,
} from "../types/documents";

interface IDCardProps {
  students: Student[];
  logo: string;
}

const THEME = {
  card: "bg-white rounded-2xl shadow-xl border border-slate-100",
  input:
    "w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all",
  btnPrimary:
    "inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20",
  btnSecondary:
    "inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-all",
};

export const IDCard: React.FC<IDCardProps> = ({ students, logo }) => {
  const institutionName = useUIStore((state) => state.institutionName);
  const shortName = useUIStore((state) => state.shortName);
  const primaryColor = useUIStore((state) => state.primaryColor);
  const secondaryColor = useUIStore((state) => state.secondaryColor);
  const accentColor = useUIStore((state) => state.accentColor);
  const storeLogo = useUIStore((state) => state.logo);
  const configuredLogo = logo || storeLogo;
  const institutionCode = shortName.toUpperCase().includes("BMI") ? "BMI" : shortName.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "ORG";
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCard, setGeneratedCard] = useState<StudentIDCardType | null>(
    null,
  );
  const [securityFeatures, setSecurityFeatures] =
    useState<DocumentSecurityFeatures | null>(null);
  const [activeDesign, setActiveDesign] = useState<
    "modern" | "classic" | "minimal"
  >("modern");

  const getFirstName = (student: Student) =>
    student.first_name || (student as unknown as Record<string, string>).firstName || "";
  const getLastName = (student: Student) =>
    student.last_name || (student as unknown as Record<string, string>).lastName || "";
  const getProgram = (student: Student) =>
    student.program_code || (student as unknown as Record<string, string>).program || "";
  const getFaculty = (student: Student) =>
    (student as unknown as Record<string, string>).faculty || student.program_code;
  const getDepartment = (student: Student) =>
    (student as unknown as Record<string, string>).department || student.program_code;
  const getStudentNumber = (student: Student) =>
    (student as unknown as Record<string, string>).student_number ||
    (student as unknown as Record<string, string>).studentNumber ||
    student.id;



  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchTerm.toLowerCase();
      return `${getFirstName(s)} ${getLastName(s)} ${s.id}`
        .toLowerCase()
        .includes(q);
    });
  }, [students, searchTerm]);

  const generateCardData = useCallback(
    async (
      student: Student,
    ): Promise<{
      card: StudentIDCardType;
      security: DocumentSecurityFeatures;
    }> => {
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 4);

      // Card data shape is a superset of StudentIDCard — cast via unknown to bypass
      // the strict Omit<> check while preserving runtime correctness.
      const cardData = {
        institutionName,
        shortName,
        institutionCode,
        studentId: student.id,
        studentName: `${getFirstName(student)} ${getLastName(student)}`,
        studentNumber: getStudentNumber(student),
        program: getProgram(student),
        faculty: getFaculty(student),
        department: getDepartment(student),
        issueDate: new Date().toISOString().split("T")[0],
        expiryDate: expiryDate.toISOString().split("T")[0],
        bloodGroup: "O+",
        emergencyContact: {
          name: "Emergency Contact",
          phone: student.phone || "+254 XXX XXX XXX",
          relationship: "Next of Kin",
        },
        status: "active" as DocumentStatus,
        createdBy: "admin",
      };

      // cardData is a superset of StudentIDCard — cast to satisfy the service signature
      const cardDataTyped = cardData as unknown as Omit<
        StudentIDCardType,
        "id" | "type" | "createdAt" | "updatedAt" | "security"
      >;

      const security = await documentService.generateSecurityFeatures(
        "id_card",
        student.id,
        cardDataTyped,
        {
          includeBlockchain: false,
        },
      );

      const card = await documentService.createDocument<StudentIDCardType>(
        "id_card",
        student.id,
        cardDataTyped as unknown as Parameters<typeof documentService.createDocument<StudentIDCardType>>[2],
        {
          createdBy: "admin",
        },
      );

      return { card, security };
    },
    [institutionName, shortName, institutionCode],
  );

  const handleGenerate = async () => {
    if (!selectedStudent) return;
    setIsGenerating(true);
    try {
      const { card, security } = await generateCardData(selectedStudent);
      setGeneratedCard(card);
      setSecurityFeatures(security);
      setShowCard(true);
    } catch (error) { // eslint-disable-next-line no-console
      console.error("ID Card generation failed:", error);
     } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!generatedCard) return;
    const element = document.getElementById("modern-idcard");
    if (!element) return;

    try {
      const html2pdf = await getHtml2Pdf();

      const opt = {
        margin: 0,
        filename: `ID_CARD_${generatedCard.studentId}.pdf`.toUpperCase(),
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: [85.6, 54], orientation: "landscape" },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (error) { // eslint-disable-next-line no-console
      console.error("PDF generation failed:", error);
     }
  };

  const designStyles = {
    modern: {
      front: primaryColor,
      back: secondaryColor,
      accent: accentColor,
    },
    classic: {
      front: secondaryColor,
      back: primaryColor,
      accent: accentColor,
    },
    minimal: {
      front: primaryColor,
      back: primaryColor,
      accent: secondaryColor,
    },
  };

  const style = designStyles[activeDesign];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-xl shadow-violet-500/20">
              <CreditCard className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Student ID Cards
              </h1>
              <p className="text-slate-500">
                Generate secure student identification cards
              </p>
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
                <Search size={18} className="text-violet-500" />
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
                className={`bg-white rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg border-2 ${
                  selectedStudent?.id === student.id
                    ? "border-violet-500 shadow-lg"
                    : "border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                    {getFirstName(student)[0]}
                    {getLastName(student)[0]}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900">
                      {getFirstName(student)} {getLastName(student)}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {student.id} • {getProgram(student)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Settings */}
          {selectedStudent && (
            <div className={THEME.card}>
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Card Design</h3>
              </div>
              <div className="p-4 space-y-4">
                {/* Design Selection */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: "modern",
                      name: "Modern",
                      color: "from-indigo-500 to-purple-600",
                    },
                    {
                      id: "classic",
                      name: "Classic",
                      color: "from-emerald-500 to-teal-600",
                    },
                    {
                      id: "minimal",
                      name: "Minimal",
                      color: "from-slate-600 to-slate-700",
                    },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setActiveDesign(d.id as "modern" | "classic" | "minimal")}
                      className={`p-3 rounded-xl border-2 transition-all ${activeDesign === d.id ? "border-violet-500 bg-violet-50" : "border-slate-100 hover:border-slate-200"}`}
                    >
                      <div
                        className={`w-8 h-8 rounded-lg bg-gradient-to-br ${d.color} mb-2 mx-auto`}
                      />
                      <p className="text-xs font-semibold text-slate-700 text-center">
                        {d.name}
                      </p>
                    </button>
                  ))}
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
                      Generate ID Card
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Preview */}
        <div className="col-span-7">
          {showCard && generatedCard && securityFeatures ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-lg">
                  ID Card Preview
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className={THEME.btnPrimary}
                  >
                    <Download size={18} />
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="flex gap-6 justify-center">
                {/* Front of Card */}
                <div
                  id="modern-idcard"
                  className="relative w-[340px] h-[215px] rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${style.front}, ${style.back})` }} />

                  {/* Pattern Overlay */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.4' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3Ccircle cx='13' cy='13' r='3'/%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                  />

                  <div className="relative h-full p-5 flex flex-col text-white">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                          <img
                            src={configuredLogo}
                            alt={shortName}
                            className="w-5 h-5 object-contain brightness-0 invert"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-bold leading-tight">
                            {shortName.toUpperCase()}
                          </p>
                          <p className="text-[8px] opacity-80">
                            STUDENT IDENTITY CARD
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-md bg-white px-1 py-0.5 text-[#0B2F75]">
                        <picture>
                          <source type="image/webp" srcSet="/brand/bazion-platform-mark-64.webp 64w, /brand/bazion-platform-mark-128.webp 128w, /brand/bazion-platform-mark-256.webp 256w" sizes="30px" />
                          <img src={PLATFORM_BRAND_MARK_URL} alt="Bazion Web" width={30} height={25} className="h-[25px] w-[30px] object-contain" />
                        </picture>
                        <span className="text-[6px] font-bold leading-tight">Powered by<br />Bazion Web</span>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex gap-4 flex-1">
                      {/* Photo Placeholder */}
                      <div className="w-20 h-24 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm border-2 border-white/30">
                        <User size={32} className="opacity-50" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] opacity-70 uppercase tracking-wider">
                          Student Name
                        </p>
                        <p className="text-sm font-bold truncate">
                          {generatedCard.studentName}
                        </p>

                        <p className="text-[10px] opacity-70 uppercase tracking-wider mt-2">
                          ID Number
                        </p>
                        <p className="text-xs font-mono">
                          {generatedCard.studentNumber}
                        </p>

                        <p className="text-[10px] opacity-70 uppercase tracking-wider mt-2">
                          Program
                        </p>
                        <p className="text-xs truncate">
                          {generatedCard.program}
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/20">
                      <div className="text-[9px] opacity-70">
                        <p>
                          Valid Until:{" "}
                          {generatedCard.expiryDate
                            ? new Date(
                                generatedCard.expiryDate,
                              ).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <div className="w-8 h-8 bg-white rounded p-0.5">
                        <img
                          src={securityFeatures.qrCodeDataUrl}
                          alt="QR"
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Holographic Stripe */}
                  <div className="absolute top-0 right-16 w-8 h-full bg-gradient-to-b from-transparent via-white/20 to-transparent transform skew-x-12" />
                </div>

                {/* Back of Card */}
                <div className="relative w-[340px] h-[215px] rounded-2xl shadow-2xl overflow-hidden">
                  <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${style.back}, ${style.front})` }} />

                  <div className="relative h-full p-5 flex flex-col text-white">
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-[10px] opacity-70 uppercase tracking-wider">
                          Emergency Contact
                        </p>
                        <p className="text-sm font-semibold">
                          {typeof generatedCard.emergencyContact === "string"
                            ? generatedCard.emergencyContact
                            : generatedCard.emergencyContact?.phone}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] opacity-70 uppercase tracking-wider">
                          Blood Group
                        </p>
                        <p className="text-sm font-semibold">
                          {generatedCard.bloodGroup}
                        </p>
                      </div>

                      <div>
                        <p className="text-[10px] opacity-70 uppercase tracking-wider">
                          Department
                        </p>
                        <p className="text-sm">{generatedCard.department}</p>
                      </div>

                      <div>
                        <p className="text-[10px] opacity-70 uppercase tracking-wider">
                          Faculty
                        </p>
                        <p className="text-sm">{generatedCard.faculty}</p>
                      </div>
                    </div>

                    <div className="mt-auto pt-2 border-t border-white/20 flex items-center gap-2">
                      <p className="text-[7px] opacity-70 text-center leading-relaxed flex-1">
                        This card is the property of {institutionName}.
                        <br />
                        If found, please return to the Security Office.
                        <br />
                        <span className="font-mono">
                          {securityFeatures.serialNumber}
                        </span>
                      </p>
                      <div className="shrink-0 rounded-sm bg-white px-1 py-0.5 text-[#0B2F75] flex items-center gap-1">
                        <picture>
                          <source type="image/webp" srcSet="/brand/bazion-platform-mark-64.webp 64w, /brand/bazion-platform-mark-128.webp 128w, /brand/bazion-platform-mark-256.webp 256w" sizes="14px" />
                          <img src={PLATFORM_BRAND_MARK_URL} alt="" aria-hidden="true" width={14} height={12} className="h-3 w-[14px] object-contain" />
                        </picture>
                        <span className="text-[5px] font-bold leading-tight">Bazion Web</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`${THEME.card} h-full min-h-[400px] flex flex-col items-center justify-center p-12 text-center`}
            >
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <IdCardIcon className="text-slate-400" size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                No ID Card Generated
              </h3>
              <p className="text-slate-500 max-w-md">
                Select a student from the list and choose a design to generate a
                secure student ID card.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IDCard;









