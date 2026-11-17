/**
 * BMI UMS — Unified Document Verification Portal
 *
 * Public page — no authentication required.
 * Verifies BOTH certificates (BMI-YYYY-NNNNNN) and
 * transcripts (BMI-TRANS-YYYY-NNNNNN) through one unified backend endpoint.
 *
 * Three input paths:
 *   1. URL deep-link  /verify?id=SERIAL&t=TOKEN  (QR scan → opens this URL)
 *   2. Manual entry   user types serial number
 *   3. Camera QR scan via QRScanner component
 *
 * Confidence levels:
 *   HIGH  — serial found + HMAC token verified    (QR scan path)
 *   LOW   — serial found, no token provided        (manual serial only)
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from '../shims/react-i18next';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  QrCode,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  GraduationCap,
  Scroll,
  
  Building2,
  Hash,
  
  RefreshCcw,
  Copy,
  Check,
  Calendar,
  
  MapPin,
  Clock,
  
  
} from '../shims/lucide-react';
import { ADMIN_EMAIL } from '../services/contracts-bridge';
import QRScanner from "./QRScanner";
import {
  verifyDocument,
  verifyQRScan,
  parseQRPayload,
  type DocumentVerifyResult,
} from "../services/verificationService";

interface VerificationPageProps {
  logo?: string;
}

// ─── Small helpers ────────────────────────────────────────────────────────────
function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch { return iso;
  }
}

const normalizeDepartment = (dept?: string) => {
   if (!dept) return "Biblical Studies and Applied Ministry";
   const d = dept.trim();
   const upper = d.toUpperCase();
   if (
     upper === "BIBLICAL STUDIES & MINISTRY" ||
     upper === "BIBLICAL STUDIES" ||
     upper === "DEPARTMENT OF BIBLICAL STUDIES AND APPLIED MINISTRY"
   ) {
     return "Biblical Studies and Applied Ministry";
   }
   return d.replace(/^Department of\s+/i, "");
 };

function ConfidencePill({
  confidence,
}: {
  confidence?: "high" | "medium" | "low";
}) {
  if (!confidence) return null;
  const cfg = {
    high: {
      label: "High Confidence",
      cls: "bg-emerald-100 text-emerald-800 border-emerald-200",
    },
    medium: {
      label: "Medium Confidence",
      cls: "bg-amber-100 text-amber-800 border-amber-200",
    },
    low: {
      label: "Serial Only — Low Confidence",
      cls: "bg-gray-100 text-gray-600 border-gray-200",
    },
  }[confidence];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-widest ${cfg.cls}`}
    >
      {confidence === "high" && <Check size={10} />}
      {cfg.label}
    </span>
  );
}

const VerificationPage: React.FC<VerificationPageProps> = ({ logo }) => {
  const { t } = useTranslation();
  const [serial, setSerial] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<DocumentVerifyResult | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Deep-link / URL auto-verify ──────────────────────────────────────────────
  useEffect(() => {
    // Use the unified parser so legacy ?s= format is handled identically
    // to the new ?id= format. The URL is treated as a QR payload.
    const fullUrl = window.location.href;
    const req = parseQRPayload(fullUrl);
    if (!req) return;

    setSerial(req.serial.toUpperCase());

    // Auto-verify immediately
    setIsVerifying(true);
    verifyDocument(req)
      .then(setResult)
      .catch((_error) =>
        setResult({
          valid: false,
          error: "Verification service unavailable.",
          code: "SERVICE_ERROR",
        })
      )
      .finally(() => setIsVerifying(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manual verification ────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const clean = serial.trim().toUpperCase();
    if (!clean) return;
    setIsVerifying(true);
    setResult(null);
    try {
      const res = await verifyDocument({ serial: clean });
      setResult(res);
    } catch { setResult({
        valid: false,
        error: "Verification service unavailable.",
        code: "SERVICE_ERROR",
       });
    } finally {
      setIsVerifying(false);
    }
  }, [serial]);

  // ── QR scanner callback ────────────────────────────────────────────────────
  const handleQRScan = useCallback(async (qrContent: string) => {
    setShowScanner(false);
    const req = parseQRPayload(qrContent);
    if (!req) {
      setResult({
        valid: false,
        error: "This QR code is not from BMI University.",
        code: "INVALID_QR",
      });
      return;
    }
    setSerial(req.serial.toUpperCase());
    setIsVerifying(true);
    try {
      const res = await verifyQRScan(qrContent);
      setResult(res);
    } catch { setResult({
        valid: false,
        error: "QR verification failed.",
        code: "QR_ERROR",
       });
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const handleReset = () => {
    setSerial("");
    setResult(null);
    // Clear URL params without reload
    window.history.replaceState({}, "", "/verify");
  };

  const handleCopySerial = async () => {
    if (!result?.document?.serial_number) return;
    await navigator.clipboard
      .writeText(result.document.serial_number)
      .catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Document type label ────────────────────────────────────────────────────
  const docTypeLabel =
    result?.documentType === "transcript"
      ? "Academic Transcript"
      : result?.documentType === "certificate"
        ? "Graduation Certificate"
        : "BMI University Document";

/*
  const docTypeIcon =
    result?.documentType === "transcript" ? (
      <Scroll size={20} />
    ) : (
      <GraduationCap size={20} />
    );
*/

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0a0015]">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#4B0082] text-white py-3 px-6 text-center text-[10px] font-bold uppercase tracking-widest">
        Official Document Verification Portal · BMI University · Secure &amp;
        Private
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-5">
          <img
            src={logo || "/BMI.svg"}
            alt="BMI University"
            className="w-14 h-14 object-contain rounded-xl border-2 border-[#FFD700] bg-white"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <h1 className="text-2xl font-black text-[#2E004F] uppercase tracking-tight">
              BMI University
            </h1>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest">
              Document Authenticity Verification
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-2 text-[#4B0082]">
            <ShieldCheck size={18} />
            <span className="text-xs font-black uppercase tracking-widest">
              Cryptographically Secured
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* ── Input card ────────────────────────────────────────────────────── */}
        {!result && (
          <div className="bg-white border border-gray-100 shadow-sm rounded-none p-8 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-purple-50 rounded-none">
                <Search size={20} className="text-[#4B0082]" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-gray-900">
                  Enter Document Serial Number
                </h2>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest mt-0.5">
                  Certificates: BMI-YYYY-NNNNNN · Transcripts:
                  BMI-TRANS-YYYY-NNNNNN
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={serial}
                onChange={(e) => setSerial(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="BMI-2026-123456"
                spellCheck={false}
                className="flex-1 px-4 py-3 border border-gray-200 font-mono text-sm outline-none focus:ring-2 focus:ring-[#4B0082] focus:border-transparent uppercase tracking-wider"
              />
              <button
                onClick={handleVerify}
                disabled={isVerifying || !serial.trim()}
                className="px-6 py-3 bg-[#4B0082] text-white font-black text-xs uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isVerifying ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                {isVerifying ? "Verifying…" : "Verify"}
              </button>
            </div>

            {/* QR Scan button */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] text-gray-400 font-medium">
                Or scan the QR code on the document:
              </p>
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-2 px-4 py-2 border border-[#4B0082] text-[#4B0082] text-[10px] font-black uppercase tracking-widest hover:bg-[#4B0082] hover:text-white transition-all"
              >
                <QrCode size={14} />
                Scan QR Code
              </button>
            </div>
          </div>
        )}

        {/* QR Scanner overlay */}
        {showScanner && (
          <QRScanner
            isOpen={showScanner}
            onScan={handleQRScan}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* ── Loading state ─────────────────────────────────────────────────── */}
        {isVerifying && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-purple-100 border-t-[#4B0082] rounded-full animate-spin" />
            <p className="text-sm font-black text-gray-500 uppercase tracking-widest">
              Querying Registry…
            </p>
          </div>
        )}

        {/* ── Result ────────────────────────────────────────────────────────── */}
        {result && !isVerifying && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Status banner */}
            <div
              className={`flex items-center gap-4 p-6 border-l-8 ${
                result.valid
                  ? "bg-emerald-50 border-emerald-500"
                  : result.code === "REVOKED"
                    ? "bg-red-50 border-red-500"
                    : result.code === "TAMPERED"
                      ? "bg-red-50 border-red-600"
                      : "bg-gray-50 border-gray-400"
              }`}
            >
              <div>
                {result.valid ? (
                  <CheckCircle2 size={44} className="text-emerald-500" />
                ) : result.code === "TAMPERED" ? (
                  <ShieldX size={44} className="text-red-600" />
                ) : result.code === "REVOKED" ? (
                  <ShieldAlert size={44} className="text-red-500" />
                ) : (
                  <XCircle size={44} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  <h2
                    className={`text-xl font-black uppercase tracking-tight ${
                      result.valid ? "text-emerald-800" : "text-red-800"
                    }`}
                  >
                    {result.valid
                      ? "Document Verified — Authentic"
                      : result.code === "TAMPERED"
                        ? "Verification Failed — Possible Forgery"
                        : result.code === "REVOKED"
                          ? "Document Revoked"
                          : "Document Not Found"}
                  </h2>
                  {result.valid && (
                    <ConfidencePill
                      confidence={result.verification?.confidence}
                    />
                  )}
                </div>
                {result.valid ? (
                  <p className="text-sm text-emerald-700">
                    This {docTypeLabel.toLowerCase()} is registered in the BMI
                    University official registry and has been verified{" "}
                    {result.verification?.token_verified
                      ? "using a cryptographic HMAC token"
                      : "by serial number lookup"}
                    .
                  </p>
                ) : (
                  <p className="text-sm text-red-700">{result.error}</p>
                )}
              </div>
            </div>            {/* Document details card */}
            {result.document && (() => {
              const doc = result.document;
              // Transcripts are for graduates, certificates are graduation evidence
              const isTranscriptOrCert = result.documentType === "transcript" || result.documentType === "certificate";
              const isGraduated = doc.student_status === "Graduated" || isTranscriptOrCert;
              const enrollmentStatus = doc.student_status || (isGraduated ? "Graduated" : "Active");

              // Compute Initials
              const getInitials = (name: string) => {
                if (!name) return "ST";
                const parts = name.trim().split(/\s+/);
                if (parts.length >= 2) {
                  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
                }
                return name.charAt(0).toUpperCase();
              };

              // Compute Expected Graduation Year
              const regNoMatch = doc.student_reg_no?.match(/\s\d{2}(\d)-/);
              const admissionYearNum = doc.student_admission_year 
                ? parseInt(doc.student_admission_year) 
                : (regNoMatch ? 2020 + parseInt(regNoMatch[1]) : 2025);
              const expectedGradYear = admissionYearNum + 4;

              // Compute Graduation Date (for display)
              const gradDate = doc.student_graduation_date ? new Date(doc.student_graduation_date) : null;
              const graduationDateStr = gradDate ? formatDate(gradDate.toISOString()) : "—";

              // Compute Honors Class
              const gpaVal = doc.gpa ?? 0;
              const honorsClass = doc.graduation_class || (
                gpaVal >= 3.6 ? "First Class Honours" :
                gpaVal >= 3.0 ? "Second Class Upper" :
                gpaVal >= 2.5 ? "Second Class Lower" :
                "Pass"
              );

              // Seminary program detection (for Study Center & part-time mode naming)
              const isSeminaryProgram = doc.credential?.toLowerCase().includes("diploma") || 
                                          doc.credential?.toLowerCase().includes("ministry") || 
                                          doc.credential?.toLowerCase().includes("theology");

              const campusLabel = isSeminaryProgram ? "Study Center" : "Campus Location";
              const modeOfStudyValue = (doc.student_mode_of_study === "Part-Time" && isSeminaryProgram)
                ? "Part-Time (Seminary Mode)"
                : (doc.student_mode_of_study || "Full-Time");

              const getStatusBadge = (status: string) => {
                switch (status) {
                  case "Graduated":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Degree Conferred
                      </span>
                    );
                  case "Active":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
                        Currently Enrolled - Active
                      </span>
                    );
                  case "Suspended":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-100 text-red-800 border border-red-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
                        Suspended
                      </span>
                    );
                  case "Inactive":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                        Inactive
                      </span>
                    );
                  case "Applicant":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Admission Applicant
                      </span>
                    );
                  case "On Leave":
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        On Leave
                      </span>
                    );
                  default:
                    return (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                        {status}
                      </span>
                    );
                }
              };

              return (
                <div className="bg-white border border-gray-100 shadow-xl overflow-hidden rounded-xl">
                  {/* Premium Profile Header */}
                  <div className="relative p-6 sm:p-8 bg-gradient-to-br from-slate-50 to-slate-100/50 border-b border-gray-100 flex flex-col sm:flex-row items-center gap-6">
                    {/* Official Watermark logo */}
                    <img
                      src="/BMI.svg"
                      className="absolute right-6 top-6 h-12 opacity-10 select-none pointer-events-none"
                      alt=""
                    />

                    {/* Passport Photo Frame */}
                    <div className="relative flex-shrink-0">
                      {doc.student_photo ? (
                        <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500 shadow-lg relative group transition-transform duration-300 hover:scale-105">
                          <img
                            src={doc.student_photo}
                            className="w-full h-full object-cover"
                            style={{
                              transform: doc.student_photo_zoom ? `scale(${doc.student_photo_zoom})` : undefined,
                              transformOrigin: doc.student_photo_position ? `${doc.student_photo_position.x}% ${doc.student_photo_position.y}%` : undefined
                            }}
                            alt="Student Passport"
                          />
                        </div>
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[#4B0082]/10 to-[#4B0082]/20 border-4 border-emerald-500 shadow-lg flex items-center justify-center text-[#4B0082] font-black tracking-widest text-3xl">
                          {getInitials(doc.holder_name)}
                        </div>
                      )}
                      {/* Registry Verified badge on photo */}
                      <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1.5 rounded-full shadow-md border-2 border-white" title="Verified Record">
                        <ShieldCheck size={14} className="animate-pulse" />
                      </span>
                    </div>

                    {/* Student Info Box */}
                    <div className="text-center sm:text-left flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2 justify-center sm:justify-start">
                        <h3 className="text-xl sm:text-2xl font-black text-gray-900 uppercase tracking-tight truncate">
                          {doc.holder_name}
                        </h3>
                      </div>
                      <p className="text-xs font-mono text-gray-500 font-bold uppercase tracking-wider mb-3">
                        Reg No: {doc.student_reg_no || doc.serial_number}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        {getStatusBadge(enrollmentStatus)}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-[#4B0082]">
                          {docTypeLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Core Academic Metadata Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-gray-100">
                    {[
                      {
                        label: result.documentType === "transcript" ? `Academic ${t('academic.program')}` : "Qualification Title",
                        value: doc.credential,
                        icon: <Scroll className="text-[#4B0082]" size={15} />,
                      },
                      {
                        label: "Faculty & Department",
                        value: `${doc.faculty || "School of Theology and Ministry"} — ${normalizeDepartment(doc.department)}`,
                        icon: <Building2 className="text-[#4B0082]" size={15} />,
                      },
                      {
                        label: campusLabel,
                        value: doc.student_campus || "Main Campus",
                        icon: <MapPin className="text-[#4B0082]" size={15} />,
                      },
                      {
                        label: "Mode of Study",
                        value: modeOfStudyValue,
                        icon: <Clock className="text-[#4B0082]" size={15} />,
                      },
                      {
                        label: "Admission Year",
                        value: doc.student_admission_year || admissionYearNum.toString(),
                        icon: <Calendar className="text-[#4B0082]" size={15} />,
                      },
                      {
                        label: isGraduated ? "Graduation Date" : "Expected Graduation Year",
                        value: isGraduated 
                          ? graduationDateStr
                          : expectedGradYear.toString(),
                        icon: <GraduationCap className="text-[#4B0082]" size={15} />,
                      },
                      isGraduated ? {
                        label: "Honors Classification",
                        value: honorsClass,
                        icon: <ShieldCheck className="text-emerald-600" size={15} />,
                      } : null
                    ]
                      .filter(Boolean)
                      .map((field: any, idx) => (
                        <div
                          key={idx}
                          className="px-6 py-4 border-r border-b border-gray-100 last:border-r-0 flex items-start gap-3.5 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="mt-1 flex-shrink-0">{field.icon}</div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                              {field.label}
                            </p>
                            <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">
                              {field.value}
                            </p>
                          </div>
                        </div>
                      ))}

                    {/* Serial Number bar */}
                    <div className="bg-slate-50/50 px-6 py-4 flex items-start gap-3.5 sm:col-span-2">
                      <div className="mt-1 text-[#4B0082] flex-shrink-0">
                        <Hash size={15} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                          Ledger Serial Number
                        </p>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-black text-gray-900 font-mono tracking-wider truncate">
                            {doc.serial_number}
                          </p>
                          <button
                            onClick={handleCopySerial}
                            className="p-1.5 text-gray-400 hover:text-[#4B0082] transition-colors flex-shrink-0 bg-white border border-gray-200 rounded"
                            title="Copy serial number"
                          >
                            {copied ? (
                              <Check size={12} className="text-emerald-500 font-bold" />
                            ) : (
                              <Copy size={12} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cryptographic Verification Stamp */}
                  <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-t border-gray-100 p-6 flex flex-col sm:flex-row items-center gap-4 sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500 text-white rounded-full shadow-md shadow-emerald-500/20">
                        <ShieldCheck size={20} className="animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-wide">
                          Registry Authenticated
                        </p>
                        <p className="text-[10px] text-emerald-700 font-medium">
                          Verified at {new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "medium" })}
                        </p>
                      </div>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-0.5">
                        Verification Protocol
                      </p>
                      <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider font-mono">
                        HMAC-SHA256 • Registry v2
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* Verification metadata */}
            {result.verification && (
              <div className="bg-white border border-gray-100 shadow-sm px-6 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-3">
                  Verification Record
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  {[
                    {
                      label: "Timestamp",
                      value: formatDate(result.verification.timestamp),
                    },
                    {
                      label: "Method",
                      value: result.verification.method
                        .replace("_", " ")
                        .toUpperCase(),
                    },
                    {
                      label: "Token Verified",
                      value: result.verification.token_verified
                        ? "YES ✓"
                        : "NO (serial only)",
                    },
                    {
                      label: "Verification #",
                      value: `#${result.verification.verification_count}`,
                    },
                  ].map((item, i) => (
                    <div key={i}>
                      <p className="text-[8px] font-black uppercase tracking-widest text-gray-400">
                        {item.label}
                      </p>
                      <p className="text-xs font-black text-gray-700 mt-0.5">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error details when invalid */}
            {!result.valid && result.code !== "REVOKED" && (
              <div className="bg-amber-50 border border-amber-200 px-6 py-4 flex items-start gap-3">
                <AlertCircle
                  size={16}
                  className="text-amber-600 mt-0.5 flex-shrink-0"
                />
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">
                    What to do
                  </p>
                  <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                    {result.code === "TAMPERED" && (
                      <>
                        <li>Do NOT accept this document as genuine.</li>
                        <li>
                          Contact the BMI University Registrar immediately.
                        </li>
                        <li>
                          Report the document reference number:{" "}
                          <span className="font-mono font-bold">{serial}</span>
                        </li>
                      </>
                    )}
                    {result.code === "NOT_FOUND" && (
                      <>
                        <li>
                          Confirm the serial number is entered exactly as
                          printed.
                        </li>
                        <li>
                          If recently issued, the system may take a few minutes
                          to update.
                        </li>
                        <li>
                          Contact the BMI University Registrar if the issue
                          persists.
                        </li>
                      </>
                    )}
                    {result.code === "INVALID_FORMAT" && (
                      <>
                        <li>
                          Certificates:{" "}
                          <span className="font-mono">BMI-YYYY-NNNNNN</span>
                        </li>
                        <li>
                          Transcripts:{" "}
                          <span className="font-mono">
                            BMI-TRANS-YYYY-NNNNNN
                          </span>
                        </li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-5 py-2.5 border border-gray-200 text-gray-600 text-[10px] font-black uppercase tracking-widest hover:border-[#4B0082] hover:text-[#4B0082] transition-all"
              >
                <RefreshCcw size={13} />
                Verify Another
              </button>
              {!result.valid && (
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#4B0082] text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                >
                  <QrCode size={13} />
                  Scan QR
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-gray-100 bg-white py-8 px-6 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 text-[#4B0082]">
          <img
            src={logo || "/BMI.svg"}
            alt=""
            className="w-6 h-6 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-xs font-black uppercase tracking-widest">
            BMI University
          </span>
        </div>
        <p className="text-[10px] text-gray-400 font-medium">
          This portal verifies documents issued by Bethel Ministries International (BMI) University. All verification attempts are logged for security
          purposes.
        </p>
        <p className="text-[10px] text-gray-400">
          Email: {ADMIN_EMAIL} &nbsp;·&nbsp;
          <span>East Africa: +254-726-912577 &nbsp;·&nbsp; US: 704-607-5540</span>
        </p>
      </footer>
    </div>
  );
};

export default VerificationPage;









