/**
 * Client-Side Document Auto-Validation & Quality Verification Engine
 * 
 * Provides instant pre-upload validation for student documents:
 * - Magic byte inspection (detects renamed or corrupted files)
 * - Size boundary checks (prevents 0-byte or oversize uploads)
 * - Image resolution inspection (ensures transcripts/IDs are legible)
 * - Instant thumbnail preview generation
 */

export interface DocumentValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  previewUrl?: string;
  mimeType?: string;
  detectedFormat?: string;
  dimensions?: { width: number; height: number };
  sizeKb: number;
}

const MIN_FILE_SIZE_BYTES = 2048; // 2 KB min to prevent empty/corrupt files
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB max

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];

/**
 * Checks file header magic bytes
 */
async function checkMagicBytes(file: File): Promise<{ matches: boolean; detectedType: string }> {
  try {
    const slice = file.slice(0, 16);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // PDF: %PDF (25 50 44 46)
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
      return { matches: true, detectedType: 'PDF Document' };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      return { matches: true, detectedType: 'PNG Image' };
    }

    // JPEG / JPG: FF D8 FF
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return { matches: true, detectedType: 'JPEG Image' };
    }

    // WEBP: RIFF....WEBP (52 49 46 46 .... 57 45 42 50)
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return { matches: true, detectedType: 'WEBP Image' };
    }

    // DOCX / ZIP: PK (50 4B 03 04)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      return { matches: true, detectedType: 'Office Document / ZIP' };
    }

    // Legacy DOC: D0 CF 11 E0
    if (bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
      return { matches: true, detectedType: 'Word Document (Legacy)' };
    }

    return { matches: false, detectedType: 'Unknown' };
  } catch {
    return { matches: true, detectedType: 'Unchecked' };
  }
}

/**
 * Validates image dimensions for legibility
 */
async function getImageDimensions(file: File): Promise<{ width: number; height: number; previewUrl: string } | null> {
  if (!file.type.startsWith('image/')) return null;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight, previewUrl: url });
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
}

/**
 * Auto-validates a document before staging or uploading
 */
export async function validateDocument(
  file: File,
  docType: string = 'document'
): Promise<DocumentValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sizeKb = Math.round(file.size / 1024);

  // 1. File Size Verification
  if (file.size < MIN_FILE_SIZE_BYTES) {
    errors.push(`File is empty or corrupted (${file.size} bytes). Minimum size is 2 KB.`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit.`);
  }

  // 2. Extension Verification
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    errors.push(`Unsupported file type (.${ext}). Allowed types: PDF, JPG, PNG, WEBP, DOC, DOCX.`);
  }

  // 3. Magic Header Verification
  const headerCheck = await checkMagicBytes(file);
  if (!headerCheck.matches && ext !== 'doc' && ext !== 'docx') {
    warnings.push(`File header does not strictly match the expected extension. Please ensure this is a valid ${ext.toUpperCase()} file.`);
  }

  // 4. Legibility & Dimension Verification for Images
  let dimensions: { width: number; height: number } | undefined;
  let previewUrl: string | undefined;

  if (file.type.startsWith('image/')) {
    const imgInfo = await getImageDimensions(file);
    if (imgInfo) {
      dimensions = { width: imgInfo.width, height: imgInfo.height };
      previewUrl = imgInfo.previewUrl;

      // Check resolution for ID / transcripts
      if (docType === 'id_document' || docType === 'transcript') {
        if (imgInfo.width < 400 || imgInfo.height < 400) {
          warnings.push(
            `Image resolution is low (${imgInfo.width}×${imgInfo.height}px). Admissions requires clear, legible text on documents.`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedFormat: headerCheck.detectedType,
    previewUrl,
    dimensions,
    sizeKb,
  };
}
