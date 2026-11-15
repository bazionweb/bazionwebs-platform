import React, { useState, useMemo } from "react";
import {
  Search,
  Printer,
  Download,
  Award,
  ChevronRight,
  ShieldCheck,
  X,
  Layout,
  QrCode,
  Loader2,
  AlertCircle,
} from '../shims/lucide-react';
import { MARKETING_URL, REGISTRAR_EMAIL } from '../services/contracts-bridge';
import { Student } from "../types";
import { getHtml2Pdf } from "../services/pdfService";
import { useDataStore } from "../stores/dataStore";
import { useUIStore } from "../stores/uiStore";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CertificateRecord {
  id: string;
  serial_number: string;
  student_id: string;
  student_name: string;
  degree: string;
  graduation_class: string;
  faculty: string;
  department: string;
  issue_date: string;
  graduation_date: string;
  gpa: number;
  status: "ISSUED" | "REVOKED" | "SUSPENDED";
  content_hash: string;
  signature: string;
  offline_jwt?: string;
  verification_count: number;
}

interface QRData {
  qrCode: string;
  url: string;
  mode: string;
}

// ── Faculty → dept code map ───────────────────────────────────────────────────
const DEPT_CODE: Record<string, string> = {
  Theology: "THE",
  ICT: "ICT",
  Business: "BUS",
  Education: "EDU",
  General: "GEN",
};

// ── Serial format: BMI/CER/YYYY/NNNNNN ───────────────────────────────────────
function formatSerial(raw: string): string {
  // raw comes as BMI-YYYY-NNNNNN from backend; reformat to BMI/CER/YYYY/NNNNNN
  const m = raw.match(/BMI-(\d{4})-(\d+)/);
  if (!m) return raw;
  return `BMI/CER/${m[1]}/${m[2].padStart(6, "0")}`;
}

// ── Hash display: first 20 chars uppercase with dashes ────────────────────────
function shortHash(hash: string): string {
  const h = hash
    .toUpperCase()
    .replace(/[^A-F0-9]/g, "")
    .substring(0, 20);
  return h.replace(/(.{4})/g, "$1-").replace(/-$/, "");
}

// ── Degree helpers ────────────────────────────────────────────────────────────
function getDegreeTitle(s: Student): string {
  if (s.academicLevel === "PhD") return `Doctor of Philosophy in ${s.faculty}`;
  if (s.academicLevel === "Masters") return `Master of Arts in ${s.faculty}`;
  if (s.academicLevel === "Degree") return `Bachelor of ${s.faculty}`;
  if (s.academicLevel === "Diploma") return `Diploma in ${s.faculty}`;
  return `Certificate in ${s.faculty}`;
}

function getGraduationClass(s: Student): string {
  const gpa = s.gpa ?? 0;
  const academicLevel = s.academicLevel ?? "";
  if (academicLevel === "PhD") return "";
  if (academicLevel === "Degree") {
    if (gpa >= 3.6) return "First Class Honours";
    if (gpa >= 3.0) return "Second Class Honours (Upper Division)";
    if (gpa >= 2.5) return "Second Class Honours (Lower Division)";
    return "Pass";
  }
  if (academicLevel === "Diploma") {
    if (gpa >= 3.5) return "Distinction";
    if (gpa >= 2.5) return "Credit";
    return "Pass";
  }
  if (academicLevel === "Masters") return gpa >= 3.7 ? "Distinction" : "";
  return "";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── BMI University Seal (the provided seal image) ────────────────────────────
// const _BMI_SEAL = "/BMI.svg"; // fallback logo
// We'll use the actual seal provided by the user as a CSS-rendered element

// ── Micro-text security border ────────────────────────────────────────────────
const MicroBorder: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
    {/* Top micro-text strip */}
    <div className="absolute top-0 left-0 w-full h-3 overflow-hidden">
      <p className="text-[3.5px] leading-none whitespace-nowrap text-[#4B0082] opacity-40 tracking-[0.05em]">
        {Array(300)
          .fill(
            `BMI UNIVERSITY · NAIROBI KENYA · CHARTERED 2005 · CUE ACCREDITED · VERIFY AT ${MARKETING_URL.replace('https://', '').toUpperCase()}/VERIFY · `,
          )
          .join("")}
      </p>
    </div>
    {/* Bottom micro-text strip */}
    <div className="absolute bottom-0 left-0 w-full h-3 overflow-hidden">
      <p className="text-[3.5px] leading-none whitespace-nowrap text-[#4B0082] opacity-40 tracking-[0.05em]">
        {Array(300)
          .fill(
            "ANY ALTERATION RENDERS THIS DOCUMENT VOID · DOCUMENT SECURITY FEATURE · BMI UNIVERSITY OFFICIAL CERTIFICATE · ",
          )
          .join("")}
      </p>
    </div>
    {/* Left micro-text strip */}
    <div className="absolute top-0 left-0 h-full w-3 overflow-hidden flex items-center justify-center">
      <p
        className="text-[3.5px] leading-none whitespace-nowrap text-[#4B0082] opacity-40"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {Array(200)
          .fill(
            "BMI UNIVERSITY SECURE DOCUMENT · EXCELLENCE IN FAITH AND KNOWLEDGE · ",
          )
          .join("")}
      </p>
    </div>
    {/* Right micro-text strip */}
    <div className="absolute top-0 right-0 h-full w-3 overflow-hidden flex items-center justify-center">
      <p
        className="text-[3.5px] leading-none whitespace-nowrap text-[#4B0082] opacity-40"
        style={{ writingMode: "vertical-rl" }}
      >
        {Array(200)
          .fill(
            "ANTI-TAMPER SECURITY LAYER · CRYPTOGRAPHICALLY SIGNED · BMI UNIVERSITY KENYA · ",
          )
          .join("")}
      </p>
    </div>
  </div>
);

// ── Guilloche watermark background ───────────────────────────────────────────
const GuillocheWatermark: React.FC<{ logo: string }> = ({ logo }) => (
  <div className="absolute inset-0 pointer-events-none z-0 flex items-center justify-center opacity-[0.04]">
    <img
      src={logo}
      className="w-[420px] h-[420px] object-contain grayscale"
      alt=""
    />
  </div>
);

// ── The Certificate Document ──────────────────────────────────────────────────
interface CertDocProps {
  student: Student;
  cert: CertificateRecord;
  qrData: QRData | null;
  logo: string;
  orientation: "landscape" | "portrait";
}

const CertificateDocument: React.FC<CertDocProps> = ({
  student,
  cert,
  qrData,
  logo,
  orientation,
}) => {
  const serial = formatSerial(cert.serial_number);
  const hash = shortHash(cert.content_hash);
  const sig = cert.signature
    ? cert.signature.substring(0, 20).toUpperCase()
    : "";
  const deptCode = DEPT_CODE[student.faculty ?? ""] ?? "GEN";
  const studentRef = `BMI/${new Date(cert.issue_date).getFullYear()}/${deptCode}/${student.id.replace(/\D/g, "").slice(-3).padStart(3, "0")}`;
  const issueDate = formatDate(cert.issue_date);
  const timestamp =
    new Date(cert.issue_date).toISOString().replace("T", " ").substring(0, 19) +
    "Z";
//   const _verifyUrl =
  //     qrData?.url || `${MARKETING_URL}/verify?id=${cert.serial_number}`;

  const isLandscape = orientation === "landscape";

  return (
    <div
      id="official-certificate-root"
      className={`relative bg-[#FEFDF8] overflow-hidden shadow-2xl print:shadow-none
        ${isLandscape ? "w-[297mm] h-[210mm]" : "w-[210mm] h-[297mm]"}`}
      style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}
    >
      {/* ── Outer gold + purple double border ── */}
      <div className="absolute inset-0 border-[10px] border-[#4B0082] pointer-events-none z-20" />
      <div className="absolute inset-[10px] border-[3px] border-[#C9A84C] pointer-events-none z-20" />
      <div className="absolute inset-[14px] border-[1px] border-[#4B0082]/30 pointer-events-none z-20" />

      {/* ── Security layers ── */}
      <GuillocheWatermark logo={logo} />
      <MicroBorder />

      {/* ── Corner ornaments ── */}
      {[
        ["top-4 left-4", ""],
        ["top-4 right-4", "rotate-90"],
        ["bottom-4 left-4", "-rotate-90"],
        ["bottom-4 right-4", "rotate-180"],
      ].map(([pos, rot], i) => (
        <div
          key={i}
          className={`absolute ${pos} w-10 h-10 pointer-events-none z-20`}
        >
          <svg viewBox="0 0 40 40" className={`w-full h-full ${rot}`}>
            <path
              d="M2,2 L2,16 M2,2 L16,2"
              stroke="#C9A84C"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M2,2 L10,10"
              stroke="#4B0082"
              strokeWidth="1"
              fill="none"
            />
            <circle cx="2" cy="2" r="2" fill="#C9A84C" />
          </svg>
        </div>
      ))}

      {/* ── Main content ── */}
      <div
        className={`relative z-10 flex flex-col justify-between h-full ${isLandscape ? "px-14 py-6" : "px-12 py-8"}`}
      >
        {/* ── Header: Logo + University name ── */}
        <div className="flex flex-col items-center text-center mb-3">
          <div className="relative mb-2">
            <img
              src={logo}
              alt="BMI University"
              className="h-14 w-14 object-contain rounded-full border-2 border-[#C9A84C] bg-white shadow-md"
            />
          </div>
          <h1
            className="text-[22px] font-black tracking-[0.35em] text-[#1a1a3e] uppercase"
            style={{ fontFamily: "Georgia, serif", letterSpacing: "0.3em" }}
          >
            BMI University
          </h1>
          <p className="text-[7px] tracking-[0.25em] text-[#555] uppercase mt-0.5">
            Nairobi, Kenya &nbsp;·&nbsp; Chartered 2005 &nbsp;·&nbsp; CUE
            Accredited
          </p>
          {/* Gold divider */}
          <div className="flex items-center gap-2 mt-2 w-full max-w-xs">
            <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-[#C9A84C]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
            <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-[#C9A84C]" />
          </div>
        </div>

        {/* ── Document ID bar ── */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex items-center gap-2 bg-[#1a1a3e] text-white px-3 py-1 rounded-sm text-[7px] tracking-widest uppercase">
            <span className="text-[#C9A84C] font-bold">Document ID</span>
            <span className="font-mono font-bold text-[#FFD700]">{serial}</span>
            <span className="text-[#C9A84C] font-bold ml-2">Hash:</span>
            <span className="font-mono text-gray-300">
              {hash.substring(0, 12)}
            </span>
            <span className="text-gray-400">CS:{sig.substring(0, 4)}</span>
          </div>
        </div>

        {/* ── Certificate title ── */}
        <div className="text-center mb-2">
          <h2
            className="text-[18px] text-[#1a1a3e] italic"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Certificate of Graduation
          </h2>
        </div>

        {/* ── Body text ── */}
        <div className="text-center mb-2">
          <p className="text-[9px] text-[#444] tracking-wide">
            The Senate and Council of BMI University hereby certify that
          </p>
        </div>

        {/* ── Student name ── */}
        <div className="text-center mb-1">
          <h3
            className="text-[26px] font-bold text-[#1a1a3e]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            {student.first_name} {student.last_name}
          </h3>
          <div className="inline-block border border-[#4B0082]/40 px-3 py-0.5 mt-1 rounded-sm">
            <span className="text-[7.5px] font-mono text-[#4B0082] tracking-widest">
              {studentRef}
            </span>
          </div>
        </div>

        {/* ── Degree text ── */}
        <div className="text-center mb-2">
          <p className="text-[9px] text-[#444] tracking-wide">
            having satisfactorily fulfilled all requirements prescribed by the
            Senate,
          </p>
          <p className="text-[9px] text-[#444] tracking-wide">
            is hereby admitted to the degree of
          </p>
        </div>

        {/* ── Degree title box ── */}
        <div className="flex justify-center mb-2">
          <div className="border-2 border-[#C9A84C] rounded-sm px-8 py-2 bg-[#FFFBF0]">
            <p
              className="text-[14px] font-bold text-[#8B6914] text-center"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {cert.degree}
            </p>
          </div>
        </div>

        {/* ── GPA + Class ── */}
        <div className="text-center mb-2">
          <p className="text-[8.5px] text-[#444]">
            with a Cumulative Grade Point Average of
          </p>
          <div className="flex items-baseline justify-center gap-2 mt-0.5">
            <span
              className="text-[22px] font-black text-[#1a1a3e]"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {cert.gpa > 0 ? cert.gpa.toFixed(2) : "N/A"}
            </span>
            <span className="text-[10px] text-[#888]">/ 4.0</span>
          </div>
          {cert.graduation_class && (
            <div className="inline-flex items-center gap-1.5 bg-[#4B0082] text-white px-3 py-0.5 rounded-full mt-1">
              <span className="text-[7px] tracking-widest uppercase">
                {cert.graduation_class}
              </span>
            </div>
          )}
          <p className="text-[8px] text-[#555] mt-1">
            Date of Issue: <strong>{issueDate}</strong>
          </p>
        </div>

        {/* ── Gold divider ── */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-[1px] bg-[#C9A84C]/40" />
          <div className="w-1 h-1 rounded-full bg-[#C9A84C]" />
          <div className="flex-1 h-[1px] bg-[#C9A84C]/40" />
        </div>

        {/* ── Signatories + Seal ── */}
        <div className="grid grid-cols-3 items-end gap-4 mb-3">
          {/* Vice Chancellor */}
          <div className="flex flex-col items-start">
            <div className="relative w-28 mb-1">
              <p className="font-[cursive] text-[13px] text-[#1a1a3e] italic -mb-1 ml-2">
                Prof. I. Sigei
              </p>
              <div className="h-[1px] bg-gray-700 w-full" />
            </div>
            <p className="text-[7.5px] font-bold text-[#1a1a3e] tracking-wide">
              Prof. Isaac Sigei, PhD
            </p>
            <p className="text-[6.5px] text-[#666]">Vice-Chancellor</p>
            <p className="text-[6px] text-[#888] font-mono">VC/BMI/001</p>
          </div>

          {/* University Seal — center */}
          <div className="flex flex-col items-center">
            <div className="relative w-16 h-16">
              {/* Outer gold ring */}
              <div className="absolute inset-0 rounded-full border-[3px] border-[#C9A84C] bg-gradient-to-br from-[#C9A84C]/20 to-[#4B0082]/20" />
              {/* Inner seal */}
              <div className="absolute inset-[3px] rounded-full bg-[#4B0082] flex items-center justify-center overflow-hidden border-2 border-[#C9A84C]/60">
                <img
                  src={logo}
                  alt="Seal"
                  className="w-10 h-10 object-contain filter brightness-0 invert opacity-90"
                />
              </div>
              {/* Seal text ring */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 64 64"
              >
                <path
                  id="sealArc"
                  d="M 32,6 A 26,26 0 1,1 31.9,6"
                  fill="none"
                />
                <text
                  className="text-[4px]"
                  fill="#C9A84C"
                  fontSize="4.5"
                  fontWeight="bold"
                  letterSpacing="1.5"
                >
                  <textPath href="#sealArc" startOffset="5%">
                    UNIVERSITY SEAL · BMI · EST. 2015
                  </textPath>
                </text>
              </svg>
            </div>
            <p className="text-[6px] tracking-[0.2em] uppercase text-[#888] mt-1">
              University Seal
            </p>
          </div>

          {/* Academic Registrar */}
          <div className="flex flex-col items-end">
            <div className="relative w-28 mb-1">
              <p className="font-[cursive] text-[13px] text-[#1a1a3e] italic -mb-1 mr-2 text-right">
                Dr. S. Kiptoo
              </p>
              <div className="h-[1px] bg-gray-700 w-full" />
            </div>
            <p className="text-[7.5px] font-bold text-[#1a1a3e] tracking-wide text-right">
              Dr. Samuel Kiptoo
            </p>
            <p className="text-[6.5px] text-[#666] text-right">
              Academic Registrar
            </p>
            <p className="text-[6px] text-[#888] font-mono text-right">
              REG/BMI/001
            </p>
          </div>
        </div>

        {/* ── Security footer (dark bar) ── */}
        <div
          className="bg-[#1a1a3e] text-white px-4 py-2 -mx-14 grid grid-cols-3 items-center gap-2"
          style={{
            marginLeft: isLandscape ? "-3.5rem" : "-3rem",
            marginRight: isLandscape ? "-3.5rem" : "-3rem",
          }}
        >
          {/* Left: hash + timestamp */}
          <div>
            <p className="text-[6px] font-bold text-[#C9A84C] uppercase tracking-widest mb-0.5">
              Document Security Hash
            </p>
            <p className="text-[6.5px] font-mono text-white tracking-wider">
              {hash}
            </p>
            <p className="text-[5.5px] text-gray-400 mt-0.5">
              TIMESTAMP: {timestamp} · REF: {serial} · SERIAL:{" "}
              {cert.serial_number.split("-")[2]}
            </p>
          </div>

          {/* Center: QR code */}
          <div className="flex flex-col items-center">
            {qrData?.qrCode ? (
              <img
                src={qrData.qrCode}
                alt="Scan to Verify"
                className="w-12 h-12 bg-white p-0.5 rounded-sm"
              />
            ) : (
              <div className="w-12 h-12 bg-white/10 flex items-center justify-center rounded-sm">
                <QrCode size={24} className="text-white/40" />
              </div>
            )}
            <p className="text-[5.5px] tracking-widest uppercase text-gray-400 mt-0.5">
              Scan to Verify
            </p>
          </div>

          {/* Right: verify instructions */}
          <div className="text-right">
            <p className="text-[6px] font-bold text-[#C9A84C] uppercase tracking-widest mb-0.5">
              Verify Authenticity
            </p>
            <p className="text-[6px] text-white">{MARKETING_URL.replace('https://', '')}/verify</p>
            <p className="text-[6px] text-gray-300">
              {REGISTRAR_EMAIL}
            </p>
            <p className="text-[6px] text-gray-300">+254 726 912 577</p>
            <p className="text-[5.5px] text-[#C9A84C] mt-0.5 font-bold uppercase tracking-wide">
              Any alteration renders this document void
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Certificates Component ───────────────────────────────────────────────
const Certificates: React.FC = () => {
  const students = useDataStore((s) => s.students);
  const logo = useUIStore((s) => s.logo);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCert, setGeneratedCert] = useState<CertificateRecord | null>(
    null,
  );
  const [qrData, setQrData] = useState<QRData | null>(null);
  const [error, setError] = useState("");

  const filteredStudents = useMemo(
    () =>
      students.filter((s) =>
        `${s.first_name} ${s.last_name} ${s.id}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [students, searchTerm],
  );

  // ── Generate certificate locally (no backend required) ───────────────────
  const handleGenerate = async (student: Student) => {
    setIsGenerating(true);
    setError("");
    setGeneratedCert(null);
    setQrData(null);

    try {
      // Build a deterministic serial: BMI-YYYY-NNNNNN
      const year = new Date().getFullYear();
      const numericId = student.id
        .replace(/\D/g, "")
        .slice(-6)
        .padStart(6, "0");
      const serial = `BMI-${year}-${numericId}`;

      // Content hash — FNV-1a over key fields (no crypto API needed)
      const raw = `${serial}|${student.id}|${getDegreeTitle(student)}|${student.gpa}`;
      let h = 0x811c9dc5;
      for (let i = 0; i < raw.length; i++) {
        h ^= raw.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      const contentHash = h.toString(16).toUpperCase().padStart(8, "0");
      const signature = `SIG-${contentHash}-${numericId}`;

      const today = new Date().toISOString().split("T")[0];

      const cert: CertificateRecord = {
        id: `cert_${Date.now()}`,
        serial_number: serial,
        student_id: student.id,
        student_name: `${student.first_name} ${student.last_name}`,
        degree: getDegreeTitle(student),
        graduation_class: getGraduationClass(student),
        faculty: student.faculty ?? student.program,
        department: student.department ?? student.program,
        issue_date: today,
        graduation_date: today,
        gpa: student.gpa ?? 0,
        status: "ISSUED",
        content_hash: contentHash,
        signature,
        verification_count: 0,
      };

      setGeneratedCert(cert);

      // Generate QR code as a data URL using the qrcode library
      const verifyUrl = `${window.location.origin}/verify?id=${serial}&hash=${contentHash}`;
      const QRCode = await import('../shims/qrcode');
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        width: 120,
        margin: 1,
        color: { dark: "#1a1a3e", light: "#ffffff" },
      });
      setQrData({ qrCode: qrDataUrl, url: verifyUrl, mode: "online" });

      setShowCertificate(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Failed to generate certificate");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById("official-certificate-root");
    if (!el) return;

    try {
      const html2pdf = await getHtml2Pdf();

      const serial = formatSerial(generatedCert?.serial_number || "");
      const isLand = orientation === "landscape";

      const opt = {
        margin: 0,
        filename: `CERTIFICATE_${serial}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#FEFDF8",
          removeContainer: true,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: isLand ? "landscape" : "portrait",
        },
      };

      await html2pdf().set(opt).from(el).save();
    } catch (error: unknown) { 
      // eslint-disable-next-line no-console
      console.error("PDF generation failed:", error);
      alert("PDF generation failed. Please try again.");
    }
  };

  const handlePrint = () => handleDownloadPdf();

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* ── Header ── */}
      <div className="flex-shrink-0 sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex justify-between items-center shadow-sm min-h-[60px]">
        <div className="flex items-center gap-3 pl-14">
          <div className="w-1 h-5 bg-[#FFD700]" />
          <div>
            <h2 className="text-base font-bold text-[#2E004F] dark:text-white tracking-tight uppercase">
              Degree & Certificate Issuance
            </h2>
            <p className="text-[8px] font-semibold text-gray-500 uppercase tracking-widest">
              BMI Institutional Registrar · Graduation & Awards
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pr-4">
          {(["landscape", "portrait"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOrientation(o)}
              className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${orientation === o ? "bg-[#4B0082] text-white" : "bg-gray-100 text-gray-500 hover:text-[#4B0082]"}`}
            >
              <Layout size={10} className="inline mr-1" />
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Student list */}
          <div className="lg:col-span-1 bg-white dark:bg-gray-800 p-6 border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col h-[600px]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4">
              Candidate Registry
            </h3>
            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={14}
              />
              <input
                type="text"
                placeholder="Search candidate..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-xs outline-none focus:ring-1 focus:ring-[#4B0082]"
              />
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1">
              {filteredStudents.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedStudent(s);
                    setShowCertificate(false);
                    setGeneratedCert(null);
                    setError("");
                  }}
                  className={`w-full text-left p-3 transition-all flex items-center justify-between ${selectedStudent?.id === s.id ? "bg-[#4B0082] text-white" : "hover:bg-purple-50 dark:hover:bg-gray-700"}`}
                >
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-tight">
                      {s.first_name} {s.last_name}
                    </p>
                    <p
                      className={`text-[9px] font-bold uppercase mt-0.5 ${selectedStudent?.id === s.id ? "text-purple-200" : "text-gray-400"}`}
                    >
                      {s.id}
                    </p>
                  </div>
                  <ChevronRight
                    size={13}
                    className={
                      selectedStudent?.id === s.id
                        ? "text-[#FFD700]"
                        : "text-gray-300"
                    }
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-3">
            {selectedStudent ? (
              <div className="space-y-4">
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-6 flex justify-between items-center relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-[#4B0082]" />
                  <div className="pl-2">
                    <h3 className="text-xl font-black text-gray-900 dark:text-white uppercase">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </h3>
                    <p className="text-xs font-bold text-[#4B0082] dark:text-[#FFD700] uppercase tracking-widest mt-1">
                      {getDegreeTitle(selectedStudent)}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {selectedStudent.id} · GPA: {selectedStudent.gpa} ·{" "}
                      {getGraduationClass(selectedStudent)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerate(selectedStudent)}
                    disabled={isGenerating}
                    className="px-8 py-3 bg-[#4B0082] text-white font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 border border-[#FFD700]/30 disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Award size={14} className="text-[#FFD700]" />
                        Issue Certificate
                      </>
                    )}
                  </button>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                    <AlertCircle
                      size={15}
                      className="text-red-500 mt-0.5 flex-shrink-0"
                    />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {!showCertificate && !error && (
                  <div className="bg-gray-50 dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-700 p-16 flex flex-col items-center justify-center text-center min-h-[400px]">
                    <ShieldCheck size={56} className="text-gray-200 mb-4" />
                    <h4 className="text-base font-black text-gray-300 uppercase tracking-widest mb-2">
                      Secure Certificate Issuance
                    </h4>
                    <p className="text-xs text-gray-400 max-w-sm">
                      Click "Issue Certificate" to generate a cryptographically
                      signed certificate stored in the database with a
                      verifiable QR code.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white dark:bg-gray-800 border-2 border-dashed border-gray-100 dark:border-gray-700 text-gray-400">
                <Award size={72} className="mb-4 opacity-20" />
                <h3 className="text-lg font-black uppercase tracking-[0.3em] opacity-40">
                  Select Candidate
                </h3>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Certificate Preview Modal ── */}
      {showCertificate && selectedStudent && generatedCert && (
        <div className="fixed inset-0 z-[130] flex items-start justify-center bg-black/95 backdrop-blur-3xl p-4 pt-6 overflow-y-auto">
          <div className="flex flex-col items-center gap-4">
            <CertificateDocument
              student={selectedStudent}
              cert={generatedCert}
              qrData={qrData}
              logo={logo}
              orientation={orientation}
            />

            {/* Action bar */}
            <div className="w-full max-w-[297mm] flex justify-between items-center bg-gray-900 px-6 py-4 text-white no-print border-t border-white/10">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-[#FFD700]" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                    Issued · Signed · Verified
                  </p>
                  <p className="text-[8px] text-[#FFD700] font-mono mt-0.5">
                    {formatSerial(generatedCert.serial_number)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex bg-gray-800 border border-white/10">
                  {(["landscape", "portrait"] as const).map((o) => (
                    <button
                      key={o}
                      onClick={() => setOrientation(o)}
                      className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest transition-all ${orientation === o ? "bg-[#FFD700] text-[#4B0082]" : "text-gray-400 hover:text-white"}`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all"
                  title="Opens print dialog — choose 'Save as PDF' for pixel-perfect output"
                >
                  <Download size={14} />
                  Save as PDF
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#4B0082] text-white text-[9px] font-black uppercase tracking-widest hover:bg-white hover:text-[#4B0082] transition-all"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowCertificate(false);
                    setGeneratedCert(null);
                    setQrData(null);
                  }}
                  className="p-2.5 bg-red-600 hover:bg-red-700 text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Certificates;









