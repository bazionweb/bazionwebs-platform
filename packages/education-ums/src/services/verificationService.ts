/**
 * BMI UMS — Unified Document Verification Service
 *
 * Uses POST /api/v1/documents/verify which handles both certificates
 * and transcripts based on the serial number prefix.
 *
 * QR URL scheme (standard):
 *   https://…/verify?id=BMI-TRANS-2026-123456&t=a3f9b2c1d4e5f6a7  (transcript)
 *   https://…/verify?id=BMI-2026-123456&t=a3f9b2c1d4e5f6a7          (certificate)
 *
 * Offline scheme:
 *   BMI-VERIFY::BMI-2026-123456::eyJ…   (certificate offline JWT)
 */

import { API_URL } from './config';

// ─── Shared result type ───────────────────────────────────────────────────────
export interface DocumentVerifyResult {
  valid: boolean;
  documentType?: "certificate" | "transcript";
  document?: {
    serial_number: string;
    holder_name: string;
    credential: string;
    institution: string;
    issued_at: string;
    status: "active" | "revoked" | "suspended";
    faculty?: string;
    department?: string;
    graduation_class?: string;
    gpa?: number;
    academic_year?: string;
    // student-specific (new for premium portal features)
    student_photo?: string;
    student_photo_zoom?: number;
    student_photo_position?: { x: number; y: number };
    student_status?: string;
    student_reg_no?: string;
    student_campus?: string;
    student_mode_of_study?: string;
    student_admission_year?: string;
    student_year_of_study?: string;
    student_graduation_date?: string;
  };
  verification?: {
    timestamp: string;
    method: string;
    token_verified: boolean;
    confidence: "high" | "medium" | "low";
    verification_count: number;
  };
  error?: string;
  code?: string;
}

export interface VerifyRequest {
  serial: string;
  t?: string; // HMAC nonce token (new, from QR)
  sig?: string; // legacy HMAC sig (backward compat)
  hash?: string; // legacy content hash (backward compat)
  offline_jwt?: string; // offline self-contained JWT
}

// ─── QR parser ───────────────────────────────────────────────────────────────
/**
 * Parse any BMI document QR payload into a verify request.
 *
 * Handles:
 *   1. Online URL  https://…/verify?id=SERIAL&t=TOKEN
 *   2. Offline JWT BMI-VERIFY::SERIAL::eyJ…
 *   3. Plain serial BMI-TRANS-2026-123456  or  BMI-2026-123456
 *   4. Legacy URL  ?id=SERIAL&sig=SIG  or  ?s=SERIAL&h=HASH
 */
export function parseQRPayload(qrContent: string): VerifyRequest | null {
  const s = qrContent.trim();

  // ── Offline format ────────────────────────────────────────────────────────
  if (s.startsWith("BMI-VERIFY::")) {
    const parts = s.split("::");
    if (parts.length === 3) {
      return { serial: parts[1], offline_jwt: parts[2] };
    }
  }

  // ── URL format ────────────────────────────────────────────────────────────
  if (s.includes("/verify?") || s.includes("?id=") || s.includes("?s=")) {
    try {
      const url = new URL(s.startsWith("http") ? s : `https://x.com${s}`);
      // New unified scheme: ?id=SERIAL&t=TOKEN
      const id = url.searchParams.get("id");
      const t = url.searchParams.get("t");
      // Legacy schemes
      const legacySig = url.searchParams.get("sig");
      const legacyHash =
        url.searchParams.get("h") || url.searchParams.get("hash");
      const legacySerial = url.searchParams.get("s"); // old DocumentService format

      const serial = id || legacySerial;
      if (serial) {
        return {
          serial,
          t: t || undefined,
          sig: legacySig || undefined,
          hash: legacyHash || undefined,
        };
      }
    } catch (error) { // fall through
    }
  }

  // ── Plain serial number ───────────────────────────────────────────────────
  if (/^BMI-(TRANS-)?\d{4}-\d{6}$/i.test(s)) {
    return { serial: s.toUpperCase() };
  }

  return null;
}

// ─── Core verify call ─────────────────────────────────────────────────────────
/**
 * Verify a document against the backend.
 * Accepts any BMI document serial — the backend routes by prefix.
 *
 * Includes:
 *   • 12-second timeout per attempt
 *   • Up to 2 automatic retries (3 attempts total) for transient failures
 *   • Graceful handling of non-JSON responses (e.g. 502 proxy errors)
 */
export async function verifyDocument(
  req: VerifyRequest,
): Promise<DocumentVerifyResult> {
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1200;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(`${API_URL}/documents/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // Handle non-JSON responses (e.g. 502 from Vite proxy when backend is starting)
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        // Retry on transient proxy errors (502, 503, 504)
        if ([502, 503, 504].includes(res.status) && attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
        }
        return {
          valid: false,
          error:
            res.status >= 500
              ? "Verification server is temporarily unavailable. Please try again in a moment."
              : `Unexpected response (HTTP ${res.status }). Please try again.`,
          code: "SERVICE_ERROR",
        };
      }

      const data = await res.json();
      return data as DocumentVerifyResult;
    } catch (error) { clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        // Timeout — retry if we have retries left
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
          continue;
         }
        return {
          valid: false,
          error:
            "Verification timed out. Please check your connection and try again.",
          code: "TIMEOUT",
        };
      }

      // Network error (fetch itself failed) — retry
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      return {
        valid: false,
        error: "Network error. Please check your connection.",
        code: "NETWORK_ERROR",
      };
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    valid: false,
    error: "Verification failed after multiple attempts. Please try again.",
    code: "RETRY_EXHAUSTED",
  };
}

/**
 * Parse a QR scan and immediately verify.
 */
export async function verifyQRScan(
  qrContent: string,
): Promise<DocumentVerifyResult> {
  const req = parseQRPayload(qrContent);
  if (!req) {
    return {
      valid: false,
      error:
        "Invalid QR code. This does not appear to be a BMI University document.",
      code: "INVALID_QR",
    };
  }
  return verifyDocument(req);
}

// ─── Backward-compat aliases ─────────────────────────────────────────────────
/** @deprecated Use verifyDocument() */
export async function verifyCertificate(
  req: VerifyRequest,
): Promise<DocumentVerifyResult> {
  return verifyDocument(req);
}
/** @deprecated Use verifyQRScan() */
export async function verifyQRCode(
  qrContent: string,
): Promise<DocumentVerifyResult> {
  return verifyQRScan(qrContent);
}
export function parseQRCode(qrContent: string): VerifyRequest | null {
  return parseQRPayload(qrContent);
}

// Admin helpers
export async function getVerificationStats(
  token: string,
): Promise<object | null> {
  try {
    const res = await fetch(`${API_URL}/certificates/verification/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return data.success ? data.data : null;
  } catch (error) {
    return null;
  }
}

export const verificationService = {
  verifyDocument,
  verifyQRScan,
  verifyCertificate,
  verifyQRCode,
  parseQRPayload,
  parseQRCode,
  getVerificationStats,
};









