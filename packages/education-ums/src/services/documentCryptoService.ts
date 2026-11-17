import QRCode from '../shims/qrcode';
import type { DocumentType } from "../types/documents";

const PREFIXES: Record<DocumentType, string> = {
  certificate: "BMI-CERT",
  transcript: "BMI-TRANS",
  id_card: "BMI-ID",
  admission_letter: "BMI-ADM",
  good_standing: "BMI-GS",
  registration_card: "BMI-REG",
  library_card: "BMI-LIB",
  attendance_record: "BMI-ATT",
};

function getDocumentPrefix(type: DocumentType): string {
  return PREFIXES[type];
}

async function generateContentHash(data: any): Promise<string> {
  const canonicalString = JSON.stringify(data, Object.keys(data).sort());
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class DocumentCryptoService {
  async generateContentHash(data: any): Promise<string> {
    return generateContentHash(data);
  }

  generateSerialNumber(type: DocumentType, studentId: string): string {
    const year = new Date().getFullYear();
    const randomBytes = new Uint8Array(4);
    crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    const prefix = getDocumentPrefix(type);
    const cleanId = studentId.replace(/[^A-Z0-9]/gi, "").slice(0, 6);
    return `${prefix}-${year}-${cleanId}-${randomHex}`;
  }

  async generateSealHash(contentHash: string, serialNumber: string, timestamp: string): Promise<string> {
    const sealData = `${contentHash}|${serialNumber}|${timestamp}|BMI-SEAL`;
    return generateContentHash({ seal: sealData });
  }

  async generateBlockchainAnchor(previousAnchor: string | null, currentHash: string): Promise<string> {
    const anchorData = previousAnchor
      ? `${previousAnchor}|${currentHash}|${Date.now()}`
      : `${currentHash}|GENESIS|${Date.now()}`;
    return generateContentHash({ anchor: anchorData });
  }

  async generateDigitalSignature(contentHash: string, issuerKey: string): Promise<string> {
    const signatureData = `${contentHash}|${issuerKey}|${Date.now()}`;
    return generateContentHash({ sign: signatureData });
  }

  async generateQRCode(verificationUrl: string, options?: { width?: number; margin?: number }): Promise<string> {
    try {
      return await QRCode.toDataURL(verificationUrl, {
        width: options?.width || 200,
        margin: options?.margin || 2,
        color: { dark: "#4B0082", light: "#FFFFFF" },
        errorCorrectionLevel: "H",
      });
    } catch {
      return "";
    }
  }

  generateBarcodeData(serialNumber: string, studentId: string): string {
    return `\x00BMI${studentId.replace(/[^A-Z0-9]/gi, "")}${serialNumber.slice(-8)}\x00`;
  }

  generateVerificationUrl(serialNumber: string, hiddenToken?: string): string {
    const env = typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : undefined;
    const baseUrl = env?.VITE_VERIFY_URL ?? (typeof window !== 'undefined' ? window.location.origin : '');
    if (hiddenToken) {
      return `${baseUrl}/verify?id=${encodeURIComponent(serialNumber)}&t=${encodeURIComponent(hiddenToken)}`;
    }
    return `${baseUrl}/verify?id=${encodeURIComponent(serialNumber)}`;
  }
}

export let documentCryptoService: DocumentCryptoService;
export function initCryptoService(): DocumentCryptoService {
  if (!documentCryptoService) {
    documentCryptoService = new DocumentCryptoService();
  }
  return documentCryptoService;
}
