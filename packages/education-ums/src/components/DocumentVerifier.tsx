/**
 * BMI University Management System - Document Verifier
 * Unified verification interface for all institutional documents
 * Works across both legacy and modern document systems
 * 100% Open Source - No proprietary dependencies
 */

import React, { useState, useCallback } from "react";
import {
  Search,
  ShieldCheck,
  QrCode,
  AlertCircle,
  CheckCircle,
  XCircle,
  FileText,
  Award,
  CreditCard,
  Mail,
  Clock,
  
  
  Hash,
  RefreshCw,
  ExternalLink,
} from '../shims/lucide-react';
import { documentService } from "../services/documentService";
import type {
  DocumentVerificationResult,
  DocumentType,
} from "../types/documents";

interface DocumentVerifierProps {
  onClose?: () => void;
}

export const DocumentVerifier: React.FC<DocumentVerifierProps> = ({
  onClose,
}) => {
  const [serialNumber, setSerialNumber] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<DocumentVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"serial" | "qr">("serial");

  const handleVerify = useCallback(async () => {
    if (!serialNumber.trim()) {
      setError("Please enter a serial number");
      return;
    }

    setIsVerifying(true);
    setError(null);
    setResult(null);

    try {
      const verificationResult = await documentService.verifyDocument(
        serialNumber.trim(),
      );

      if (verificationResult.valid) {
        setResult(verificationResult);
      } else {
        setError(verificationResult.error || "Document verification failed");
      }
    } catch { setError("An error occurred during verification. Please try again.");
     } finally {
      setIsVerifying(false);
    }
  }, [serialNumber]);

  const handleReset = () => {
    setSerialNumber("");
    setResult(null);
    setError(null);
  };

  const getDocumentIcon = (type: DocumentType): React.ElementType => {
    const icons: Record<DocumentType, React.ComponentType<{ size?: number }>> = {
      certificate: Award,
      transcript: FileText,
      id_card: CreditCard,
      admission_letter: Mail,
      good_standing: ShieldCheck,
      registration_card: FileText,
      library_card: FileText,
      attendance_record: Clock,
    };
    return icons[type] || FileText;
  };

  const getDocumentLabel = (type: DocumentType) => {
    const labels: Record<DocumentType, string> = {
      certificate: "Certificate",
      transcript: "Transcript",
      id_card: "ID Card",
      admission_letter: "Admission Letter",
      good_standing: "Good Standing Letter",
      registration_card: "Registration Card",
      library_card: "Library Card",
      attendance_record: "Attendance Record",
    };
    return labels[type] || type;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-none border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-[#4B0082] text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} className="text-[#FFD700]" />
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight">
                Document Verification
              </h2>
              <p className="text-xs text-purple-200 uppercase tracking-widest">
                Verify authenticity of any BMI University document
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 transition-all"
            >
              <XCircle size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => {
            setActiveTab("serial");
            handleReset();
          }}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            activeTab === "serial"
              ? "bg-[#FFD700] text-[#4B0082]"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <Hash size={14} />
          Serial Number
        </button>
        <button
          onClick={() => {
            setActiveTab("qr");
            handleReset();
          }}
          className={`flex-1 px-6 py-4 text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            activeTab === "qr"
              ? "bg-[#FFD700] text-[#4B0082]"
              : "text-gray-500 hover:bg-gray-50"
          }`}
        >
          <QrCode size={14} />
          QR Code
        </button>
      </div>

      <div className="p-6 space-y-6">
        {activeTab === "serial" ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Enter Document Serial Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="e.g., BMI-CERT-2024-XXXXXX"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-none text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-[#4B0082]"
                  onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                />
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
              </div>
              <p className="mt-2 text-[10px] text-gray-400">
                Find the serial number on the document, usually near the QR code
                or in the footer
              </p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={handleVerify}
                disabled={isVerifying || !serialNumber.trim()}
                className="flex-1 px-6 py-3 bg-[#4B0082] text-white text-xs font-black uppercase tracking-widest hover:bg-[#5B1092] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Verify Document
                  </>
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 border border-gray-200 dark:border-gray-600 text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-48 h-48 mx-auto bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center mb-4">
              <QrCode size={64} className="text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">QR Code Scanner</p>
            <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto">
              Scan the QR code on any BMI University document to instantly
              verify its authenticity. This feature uses the camera on your
              device.
            </p>
            <button
              disabled
              className="mt-4 px-6 py-2 bg-gray-100 text-gray-400 text-xs font-bold uppercase tracking-widest cursor-not-allowed"
            >
              Camera Access Required
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0" size={20} />
              <div>
                <p className="text-sm font-bold text-red-700">
                  Verification Failed
                </p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Result */}
        {result && (
          <div className="border-2 border-emerald-500 rounded-none overflow-hidden">
            <div className="bg-emerald-500 text-white p-4 flex items-center gap-3">
              <CheckCircle size={20} />
              <div>
                <p className="text-sm font-black uppercase">
                  Document Verified Successfully
                </p>
                <p className="text-xs text-emerald-100">
                  This document is authentic and valid
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Document Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Document Type
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => {
                      const Icon = getDocumentIcon(
                        result.documentType as DocumentType,
                      );
                      return <Icon size={16} className="text-[#4B0082]" />;
                    })()}
                    <p className="text-sm font-bold">
                      {getDocumentLabel(result.documentType as DocumentType)}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Serial Number
                  </p>
                  <p className="text-sm font-mono text-[#4B0082] mt-1">
                    {result.serialNumber}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Status
                  </p>
                  <span
                    className={`inline-block mt-1 px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                      result.status === "issued"
                        ? "bg-emerald-100 text-emerald-600"
                        : result.status === "revoked"
                          ? "bg-red-100 text-red-600"
                          : result.status === "expired"
                            ? "bg-gray-100 text-gray-600"
                            : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Issue Date
                  </p>
                  <p className="text-sm mt-1">
                    {result.issuedAt
                      ? new Date(result.issuedAt).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Verification Metadata */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                  Verification Details
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="text-gray-600">
                      Verified at:{" "}
                      {result.verifiedAt
                        ? new Date(result.verifiedAt).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-500" />
                    <span className="text-gray-600">
                      Hash verified: {result.hashVerified ? "Yes" : "No"}
                    </span>
                  </div>
                  {result.blockchainAnchor && (
                    <div className="flex items-center gap-2 col-span-2">
                      <ExternalLink size={14} className="text-[#4B0082]" />
                      <span className="text-gray-600">
                        Blockchain: {result.blockchainAnchor}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verification Count */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                  This document has been verified {result.verificationCount}{" "}
                  time{result.verificationCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-gray-50 dark:bg-gray-700/50 p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} />
            <span>Secured by SHA-256 • Open Source Verification</span>
          </div>
          <div>BMI University Document System v2.0</div>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerifier;









