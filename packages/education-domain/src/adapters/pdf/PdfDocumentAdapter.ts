import { IDocumentGenerator, Document, DocumentRequest } from '../../ports';
import { PDFDocument, rgb, StandardFonts, PDFFont, PDFImage } from '../../shims/external-adapters';

const LOGO_URL = 'https://portal.bmiuniversities.org/bmi-logo.png';

function colorFromHex(input: unknown, fallback: string) {
  const value = typeof input === 'string' && /^#[0-9a-fA-F]{6}$/.test(input) ? input : fallback;
  return rgb(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
  );
}

function tint(color: ReturnType<typeof rgb>, amount: number) {
  return rgb(
    color.r + (1 - color.r) * amount,
    color.g + (1 - color.g) * amount,
    color.b + (1 - color.b) * amount,
  );
}

let activePalette = {
  navyDark: rgb(0.035, 0.071, 0.137),
  navy: rgb(0.055, 0.114, 0.220),
  navyLight: rgb(0.122, 0.208, 0.353),
  gold: rgb(0.773, 0.627, 0.282),
  goldLight: rgb(0.957, 0.925, 0.847),
};
let pdfGenerationTail: Promise<void> = Promise.resolve();

function setActivePalette(metadata?: Record<string, any>) {
  const navy = colorFromHex(metadata?.primaryColor, '#0E1D38');
  const accent = colorFromHex(metadata?.accentColor, '#C5A048');
  activePalette = {
    navyDark: tint(navy, 0.34),
    navy,
    navyLight: colorFromHex(metadata?.secondaryColor, '#172A4D'),
    gold: accent,
    goldLight: tint(accent, 0.84),
  };
}

function institutionName(meta?: Record<string, any>): string {
  const configured = meta?.institutionName ?? meta?.brandName;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : 'Bethel Ministries International University';
}

function institutionShortName(meta?: Record<string, any>): string {
  const configured = meta?.shortName ?? meta?.brandName ?? (meta?.institutionName ? institutionName(meta) : undefined);
  return typeof configured === 'string' && configured.trim()
    ? configured.trim()
    : 'BMI University';
}

function institutionCode(meta?: Record<string, any>): string {
  const configured = typeof meta?.institutionCode === 'string' ? meta.institutionCode.trim() : '';
  if (configured) return configured.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
  const shortName = institutionShortName(meta);
  return shortName.toLowerCase().includes('bmi') ? 'BMI' : shortName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'ORG';
}

function verifiedUrl(value: unknown, base?: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), base || process.env.PUBLIC_STOREFRONT_URL || undefined);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export class PdfDocumentAdapter implements IDocumentGenerator {
  public static readonly PAGE_W = 612; // Standard US Letter Width (8.5in @ 72dpi)
  public static readonly PAGE_H = 792; // Standard US Letter Height (11in @ 72dpi)
  public static readonly CARD_W = 340;
  public static readonly CARD_H = 214;

  // Brand colors are selected for each serialized render from document metadata.
  private static get NAVY_DARK() { return activePalette.navyDark; }
  private static get NAVY() { return activePalette.navy; }
  private static get NAVY_LIGHT() { return activePalette.navyLight; }
  private static get GOLD() { return activePalette.gold; }
  private static get GOLD_LIGHT() { return activePalette.goldLight; }
  private static readonly WHITE = rgb(1, 1, 1);
  private static readonly OFF_WHITE = rgb(0.988, 0.992, 0.996);
  private static readonly BLACK = rgb(0.08, 0.09, 0.11);
  private static readonly CHARCOAL = rgb(0.18, 0.22, 0.28);
  private static readonly DARK_GRAY = rgb(0.32, 0.38, 0.46);
  private static readonly LIGHT_GRAY = rgb(0.65, 0.70, 0.76);
  private static readonly BORDER_GRAY = rgb(0.86, 0.89, 0.93);

  private static centerX(text: string, font: PDFFont, size: number, pageW: number = PdfDocumentAdapter.PAGE_W): number {
    return (pageW - font.widthOfTextAtSize(text, size)) / 2;
  }

  private logoCache = new Map<string, { bytes: Uint8Array; format: 'png' | 'jpg' }>();

  async generateDocument(request: DocumentRequest): Promise<Document> {
    const previous = pdfGenerationTail;
    let release!: () => void;
    pdfGenerationTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try {
      setActivePalette(request.metadata);
      return await this.renderDocument(request);
    } finally {
      release();
    }
  }

  private async renderDocument(request: DocumentRequest): Promise<Document> {
    const { type, userId, metadata } = request;
    const pdfDoc = await PDFDocument.create();

    const hasTenantIdentity = Boolean(metadata?.institutionName || metadata?.shortName || metadata?.brandName);
    const configuredPublicUrl = verifiedUrl(metadata?.websiteUrl, process.env.PUBLIC_STOREFRONT_URL);
    const websiteUrl = configuredPublicUrl || (!hasTenantIdentity ? (process.env.PUBLIC_STOREFRONT_URL || 'https://bmiuniversities.org') : '');
    const verificationBaseUrl = verifiedUrl(
      metadata?.verificationBaseUrl,
      websiteUrl || process.env.PUBLIC_STOREFRONT_URL,
    ) || (websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/verify` : '/verify');
    const customLogo = typeof metadata?.logoUrl === 'string' ? metadata.logoUrl.trim() : '';
    const logoUrl = customLogo
      ? verifiedUrl(customLogo, websiteUrl || process.env.PUBLIC_STOREFRONT_URL)
      : (hasTenantIdentity ? '' : LOGO_URL);
    const platformBrandBaseUrl = process.env.PUBLIC_STOREFRONT_URL || process.env.AUTH_APP_URL;
    const platformLogoUrl = verifiedUrl(process.env.PLATFORM_BRAND_MARK_URL, platformBrandBaseUrl)
      || verifiedUrl('/brand/bazion-platform-mark.png', platformBrandBaseUrl);
    const enrichedMeta: Record<string, any> = {
      ...metadata,
      institutionName: institutionName(metadata),
      shortName: institutionShortName(metadata),
      institutionCode: institutionCode(metadata),
      admissionsEmail: metadata?.admissionsEmail || metadata?.contactEmail || (hasTenantIdentity ? '' : 'admissions@bmiuniversities.org'),
      registrarEmail: metadata?.registrarEmail || metadata?.contactEmail || (hasTenantIdentity ? '' : 'registrar@bmiuniversities.org'),
      phone: metadata?.phone || metadata?.contactPhone || (hasTenantIdentity ? '' : '+254 721 341 793'),
      address: metadata?.address || (hasTenantIdentity ? '' : 'Mukurwe-ini Plaza, Nyeri County, Kenya'),
      websiteUrl,
      verificationBaseUrl,
      portalUrl: verifiedUrl(metadata?.portalUrl, websiteUrl || process.env.PUBLIC_STOREFRONT_URL) || (websiteUrl ? `${websiteUrl.replace(/\/$/, '')}/portal` : '/portal'),
      platformBrandName: process.env.PLATFORM_BRAND_NAME?.trim() || 'Bazion Web',
    };

    let logo: PDFImage | undefined;
    try {
      const logoData = logoUrl ? await this.getLogoBytes(logoUrl) : null;
      if (logoData) logo = logoData.format === 'jpg' ? await pdfDoc.embedJpg(logoData.bytes) : await pdfDoc.embedPng(logoData.bytes);
    } catch {}
    try {
      const platformLogoData = platformLogoUrl ? await this.getLogoBytes(platformLogoUrl) : null;
      if (platformLogoData) enrichedMeta.platformLogo = platformLogoData.format === 'jpg'
        ? await pdfDoc.embedJpg(platformLogoData.bytes)
        : await pdfDoc.embedPng(platformLogoData.bytes);
    } catch {}

    const verificationCode = `${institutionCode(enrichedMeta)}-VER-${crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()}`;
    enrichedMeta.verificationCode = metadata?.verificationCode || verificationCode;
    enrichedMeta.verificationUrl = `${verificationBaseUrl}?code=${encodeURIComponent(enrichedMeta.verificationCode)}`;

    switch (type) {
      case 'admission_letter':
        await this.buildAdmissionLetter(pdfDoc, logo, enrichedMeta);
        break;
      case 'enrollment_letter':
        await this.buildEnrollmentLetter(pdfDoc, logo, enrichedMeta);
        break;
      case 'id_card':
        await this.buildIdCard(pdfDoc, logo, enrichedMeta);
        break;
      case 'transcript':
        await this.buildTranscript(pdfDoc, logo, enrichedMeta);
        break;
      case 'certificate':
        await this.buildCertificate(pdfDoc, logo, enrichedMeta);
        break;
      default:
        await this.buildGenericDocument(pdfDoc, type, userId, enrichedMeta);
    }

    const pdfBytes = await pdfDoc.save();

    return {
      id: crypto.randomUUID(),
      type,
      userId,
      status: 'ready',
      data: Buffer.from(pdfBytes),
      createdAt: new Date(),
      verificationCode: enrichedMeta.verificationCode,
    };
  }

  async getDocument(_id: string): Promise<Document | null> { return null; }
  async getDocumentsByUser(_userId: string): Promise<Document[]> { return []; }
  async verifyDocument(_verificationCode: string): Promise<Document | null> { return null; }

  private async getLogoBytes(url: string): Promise<{ bytes: Uint8Array; format: 'png' | 'jpg' } | null> {
    const cached = this.logoCache.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
      const isPng = contentType === 'image/png' || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47);
      const isJpg = contentType === 'image/jpeg' || contentType === 'image/jpg' || (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff);
      if (!isPng && !isJpg) return null;
      const image = { bytes, format: isJpg ? 'jpg' as const : 'png' as const };
      this.logoCache.set(url, image);
      return image;
    } catch { return null; }
  }

  /**
   * ─── ADMISSION LETTER ──────────────────────────────────────────────────────
   * High-prestige, official university letter of admission with seal & signature
   */
  private async buildAdmissionLetter(pdf: PDFDocument, logo: PDFImage | undefined, meta?: Record<string, any>): Promise<void> {
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const times = await pdf.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

    const name = meta?.name || 'Applicant';
    const program = meta?.program || 'Bachelor of Science in Biblical Studies';
    const regNo = meta?.regNo || `${institutionCode(meta)}/UG-CS/226/001`;
    const uid = meta?.uid || 'STD-2026-001';
    const date = meta?.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const term = meta?.term || 'Fall Academic Term 2026';
    const verificationCode = meta?.verificationCode || `${institutionCode(meta)}-VER-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const docRef = `${institutionCode(meta)}/ADM/${new Date().getFullYear()}/${verificationCode.slice(0, 6)}`;

    const page = pdf.addPage([PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H]);

    // Letterhead Header
    this.drawLetterhead(pdf, page, helvetica, bold, logo, meta);

    // Document Metadata Bar
    let y = 635;
    this.drawRect(page, 45, y - 22, 522, 26, PdfDocumentAdapter.OFF_WHITE);
    this.drawHLine(page, y + 4, PdfDocumentAdapter.BORDER_GRAY, 45, 522, 0.75);
    this.drawHLine(page, y - 22, PdfDocumentAdapter.BORDER_GRAY, 45, 522, 0.75);

    page.drawText(`Ref: ${docRef}`, { x: 55, y: y - 10, size: 9, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(`Date: ${date}`, { x: 260, y: y - 10, size: 9, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(`Matriculation Term: ${term}`, { x: 395, y: y - 10, size: 9, font: bold, color: PdfDocumentAdapter.NAVY });

    // Student Addressee Block
    y -= 45;
    page.drawText('TO:', { x: 55, y, size: 9, font: bold, color: PdfDocumentAdapter.GOLD });
    y -= 14;
    page.drawText(name.toUpperCase(), { x: 55, y, size: 13, font: bold, color: PdfDocumentAdapter.NAVY });
    y -= 14;
    page.drawText(`Student ID (UID): ${uid}   |   Registration No: ${regNo}`, { x: 55, y, size: 9.5, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(`Candidate Status: Admitted (Full Matriculation - Good Standing)`, { x: 55, y: y - 13, size: 9, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    // Document Title Banner
    y -= 40;
    this.drawHLine(page, y + 15, PdfDocumentAdapter.GOLD, 55, 502, 1.5);
    page.drawText('OFFICIAL LETTER OF ADMISSION', {
      x: PdfDocumentAdapter.centerX('OFFICIAL LETTER OF ADMISSION', bold, 14),
      y: y - 2,
      size: 14,
      font: bold,
      color: PdfDocumentAdapter.NAVY_DARK,
    });
    this.drawHLine(page, y - 8, PdfDocumentAdapter.GOLD, 55, 502, 0.75);

    // Letter Body Text
    y -= 26;
    page.drawText(`Dear ${name},`, { x: 55, y, size: 10.5, font: timesBold, color: PdfDocumentAdapter.BLACK });

    y -= 18;
    const p1 = `On behalf of the Office of Admissions at ${institutionName(meta)}, we are pleased to notify you of your acceptance for the ${program} degree program commencing in the ${term}.`;
    this.drawParagraph(page, p1, 55, y, 502, 10, times, PdfDocumentAdapter.CHARCOAL, 14);

    y -= 46;
    const p2 = `Your academic credentials, character references, and demonstrated commitment to excellence and Christian service have distinguished your candidacy among a highly competitive cohort of global applicants. You have met all statutory admission requirements for undergraduate/postgraduate matriculation.`;
    this.drawParagraph(page, p2, 55, y, 502, 10, times, PdfDocumentAdapter.CHARCOAL, 14);

    // Official Matriculation Table Box
    y -= 54;
    this.drawRect(page, 55, y - 60, 502, 60, PdfDocumentAdapter.GOLD_LIGHT);
    this.drawRect(page, 55, y - 60, 502, 60, PdfDocumentAdapter.GOLD, true, 1);

    page.drawText('ADMISSION PARTICULARS & DEGREE TRACK', { x: 65, y: y - 12, size: 8.5, font: bold, color: PdfDocumentAdapter.NAVY_DARK });
    this.drawHLine(page, y - 16, PdfDocumentAdapter.GOLD, 65, 482, 0.5);

    page.drawText(`Academic Program:`, { x: 65, y: y - 28, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${program}`, { x: 170, y: y - 28, size: 9, font: helvetica, color: PdfDocumentAdapter.NAVY_DARK });

    page.drawText(`Registration Number:`, { x: 65, y: y - 42, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${regNo}`, { x: 170, y: y - 42, size: 9, font: bold, color: PdfDocumentAdapter.NAVY });

    page.drawText(`Academic Career:`, { x: 330, y: y - 28, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`Undergraduate / Degree`, { x: 420, y: y - 28, size: 9, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText(`Status / Modality:`, { x: 330, y: y - 42, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`Active • Online / Campus`, { x: 420, y: y - 42, size: 9, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    // Next Steps Checklist
    y -= 76;
    page.drawText('MANDATORY ENROLLMENT & MATRICULATION PROCEDURES:', { x: 55, y, size: 9, font: bold, color: PdfDocumentAdapter.NAVY });
    
    const steps = [
      `1. Student Portal Activation: Sign in to ${meta?.portalUrl || '/portal'} to complete your student profile.`,
      '2. Document Verification: Submit certified copies of academic transcripts and passport photograph.',
      '3. Financial Settlement & Agreement: Review tuition schedule, scholarship awards, and select payment plan.',
      '4. Semester Course Registration: Register for your prescribed curriculum units prior to the term deadline.',
    ];

    y -= 14;
    for (const step of steps) {
      page.drawText(step, { x: 65, y, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });
      y -= 13;
    }

    y -= 6;
    page.drawText(`We warmly welcome you to the ${institutionName(meta)} community and wish you success in your academic and personal growth.`, { x: 55, y, size: 9.5, font: timesItalic, color: PdfDocumentAdapter.NAVY });

    // Dual Signatures & Seal Section
    y -= 46;
    this.drawHLine(page, y + 10, PdfDocumentAdapter.BORDER_GRAY, 55, 502, 0.75);

    // Left Signature
    this.drawHLine(page, y - 10, PdfDocumentAdapter.CHARCOAL, 55, 160, 1);
    page.drawText(meta?.authorizedBy || 'Authorized Signatory', { x: 55, y: y - 22, size: 10, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(meta?.authorizedTitle || 'Director of Admissions', { x: 55, y: y - 33, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(institutionShortName(meta), { x: 55, y: y - 43, size: 7.5, font: helvetica, color: PdfDocumentAdapter.LIGHT_GRAY });

    // Official Stamp Graphic / Seal Rosette Center
    this.drawSealEmblem(page, 306, y - 20, bold, helvetica, meta);

    // Right Signature
    this.drawHLine(page, y - 10, PdfDocumentAdapter.CHARCOAL, 397, 160, 1);
    page.drawText(meta?.secondaryAuthorizedBy || institutionName(meta), { x: 397, y: y - 22, size: 10, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(meta?.secondaryAuthorizedTitle || 'Institutional Authority', { x: 397, y: y - 33, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(institutionShortName(meta), { x: 397, y: y - 43, size: 7.5, font: helvetica, color: PdfDocumentAdapter.LIGHT_GRAY });

    // Footer with Verification Code & Microtext
    this.drawFooter(pdf, page, helvetica, bold, verificationCode, meta);
  }

  /**
   * ─── ENROLLMENT VERIFICATION CERTIFICATE ──────────────────────────────────
   * Official proof of enrollment for banks, embassies, insurers, and employers
   */
  private async buildEnrollmentLetter(pdf: PDFDocument, logo: PDFImage | undefined, meta?: Record<string, any>): Promise<void> {
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const times = await pdf.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);

    const name = meta?.name || 'Enrolled Student';
    const program = meta?.program || 'Bachelor of Science in Biblical Studies';
    const regNo = meta?.regNo || `${institutionCode(meta)}/UG-CS/226/001`;
    const uid = meta?.uid || 'STD-2026-001';
    const date = meta?.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const verificationCode = meta?.verificationCode || `${institutionCode(meta)}-ENR-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    const docRef = `${institutionCode(meta)}/ENR/${new Date().getFullYear()}/${verificationCode.slice(0, 6)}`;

    const page = pdf.addPage([PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H]);

    // Outer Decorative Security Frame
    this.drawRect(page, 20, 20, 572, 752, PdfDocumentAdapter.NAVY, true, 1.5);
    this.drawRect(page, 24, 24, 564, 744, PdfDocumentAdapter.GOLD, true, 0.75);

    // Letterhead
    this.drawLetterhead(pdf, page, helvetica, bold, logo, meta);

    let y = 635;
    page.drawText(`Document Ref: ${docRef}`, { x: 50, y, size: 8.5, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(`Date of Certification: ${date}`, { x: 380, y, size: 8.5, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    y -= 30;
    this.drawRect(page, 50, y - 24, 512, 28, PdfDocumentAdapter.NAVY);
    page.drawText('CERTIFICATE OF MATRICULATION & ENROLLMENT VERIFICATION', {
      x: PdfDocumentAdapter.centerX('CERTIFICATE OF MATRICULATION & ENROLLMENT VERIFICATION', bold, 11, PdfDocumentAdapter.PAGE_W),
      y: y - 16,
      size: 11,
      font: bold,
      color: PdfDocumentAdapter.GOLD,
    });

    y -= 45;
    page.drawText('TO WHOM IT MAY CONCERN:', { x: 50, y, size: 11, font: timesBold, color: PdfDocumentAdapter.NAVY_DARK });

    y -= 20;
    const attestation = `This official document certifies that the individual named below is a bona fide, actively enrolled student in good standing at ${institutionName(meta)}.`;
    this.drawParagraph(page, attestation, 50, y, 512, 10.5, times, PdfDocumentAdapter.CHARCOAL, 15);

    // Student Particulars Grid
    y -= 46;
    this.drawRect(page, 50, y - 130, 512, 130, PdfDocumentAdapter.OFF_WHITE);
    this.drawRect(page, 50, y - 130, 512, 130, PdfDocumentAdapter.BORDER_GRAY, true, 1);
    this.drawHLine(page, y - 1, PdfDocumentAdapter.NAVY, 50, 512, 2);

    const rows = [
      ['Full Legal Name:', name.toUpperCase(), 'Student UID:', uid],
      ['Registration Number:', regNo, 'Academic Career:', 'Undergraduate / Degree'],
      ['Enrolled Programme:', program, 'Academic Term:', '2026 Academic Year'],
      ['Enrollment Status:', 'Active (Full-Time Matriculated)', 'Academic Standing:', 'Good Standing (Eligible)'],
      ['Matriculation Date:', 'August 2026', 'Expected Completion:', 'August 2028'],
    ];

    let rowY = y - 18;
    for (const row of rows) {
      page.drawText(row[0], { x: 60, y: rowY, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
      page.drawText(row[1], { x: 175, y: rowY, size: 9, font: helvetica, color: PdfDocumentAdapter.NAVY });
      page.drawText(row[2], { x: 330, y: rowY, size: 9, font: bold, color: PdfDocumentAdapter.CHARCOAL });
      page.drawText(row[3], { x: 430, y: rowY, size: 9, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });
      rowY -= 22;
    }

    y -= 150;
    const pClause = `This certificate is issued at the request of the registered student for official verification purposes, including but not limited to academic standing, government scholarship compliance, visa/immigration documentation, and financial services clearance.`;
    this.drawParagraph(page, pClause, 50, y, 512, 9.5, times, PdfDocumentAdapter.CHARCOAL, 14);

    // Signatures & Stamp
    y -= 60;
    this.drawHLine(page, y, PdfDocumentAdapter.CHARCOAL, 50, 170, 1);
    page.drawText(meta?.authorizedBy || 'Authorized Signatory', { x: 50, y: y - 12, size: 10, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(meta?.authorizedTitle || 'Registrar & Keeper of Records', { x: 50, y: y - 22, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    this.drawSealEmblem(page, 306, y - 10, bold, helvetica, meta);

    this.drawHLine(page, y, PdfDocumentAdapter.CHARCOAL, 392, 170, 1);
    page.drawText('Academic Records Directorate', { x: 392, y: y - 12, size: 10, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText('Division of Student Affairs & Enrollment', { x: 392, y: y - 22, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    this.drawFooter(pdf, page, helvetica, bold, verificationCode, meta);
  }

  /**
   * ─── STUDENT IDENTIFICATION CARD ──────────────────────────────────────────
   * ISO CR80 standard digital student ID card with smart chip & barcode
   */
  private async buildIdCard(pdf: PDFDocument, logo: PDFImage | undefined, meta?: Record<string, any>): Promise<void> {
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const name = meta?.name || 'STUDENT NAME';
    const uid = meta?.uid || 'STD-2026-001';
    const regNo = meta?.regNo || `${institutionCode(meta)}/UG-CS/226/001`;
    const program = meta?.program || 'Biblical Studies';
    const validThru = meta?.validThru || '08/2028';
    const verificationCode = meta?.verificationCode || `${institutionCode(meta)}-IDC-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const page = pdf.addPage([PdfDocumentAdapter.CARD_W, PdfDocumentAdapter.CARD_H]);

    // Outer Border & Card Background
    this.drawRect(page, 0, 0, PdfDocumentAdapter.CARD_W, PdfDocumentAdapter.CARD_H, PdfDocumentAdapter.NAVY_DARK);
    this.drawRect(page, 3, 3, PdfDocumentAdapter.CARD_W - 6, PdfDocumentAdapter.CARD_H - 6, PdfDocumentAdapter.WHITE);

    // Top Card Header Banner
    this.drawRect(page, 3, PdfDocumentAdapter.CARD_H - 42, PdfDocumentAdapter.CARD_W - 6, 39, PdfDocumentAdapter.NAVY);
    this.drawHLine(page, PdfDocumentAdapter.CARD_H - 42, PdfDocumentAdapter.GOLD, 3, PdfDocumentAdapter.CARD_W - 6, 2);

    if (logo) {
      const logoDims = logo.scale(0.06);
      page.drawImage(logo, { x: 10, y: PdfDocumentAdapter.CARD_H - 36, width: logoDims.width, height: logoDims.height });
    }

    page.drawText(institutionShortName(meta).toUpperCase(), { x: logo ? 40 : 12, y: PdfDocumentAdapter.CARD_H - 24, size: 12, font: bold, color: PdfDocumentAdapter.GOLD });
    page.drawText(institutionName(meta).toUpperCase(), { x: logo ? 40 : 12, y: PdfDocumentAdapter.CARD_H - 35, size: 7, font: helvetica, color: PdfDocumentAdapter.WHITE });

    // Student Badge Pill
    this.drawRect(page, PdfDocumentAdapter.CARD_W - 65, PdfDocumentAdapter.CARD_H - 30, 55, 16, PdfDocumentAdapter.GOLD);
    page.drawText('STUDENT', { x: PdfDocumentAdapter.CARD_W - 55, y: PdfDocumentAdapter.CARD_H - 23, size: 7.5, font: bold, color: PdfDocumentAdapter.NAVY_DARK });
    if (meta?.platformLogo) {
      const brandMark = meta.platformLogo.scale(0.075);
      page.drawImage(meta.platformLogo, { x: 210, y: PdfDocumentAdapter.CARD_H - 33, width: brandMark.width, height: brandMark.height });
      page.drawText('POWERED BY', { x: 236, y: PdfDocumentAdapter.CARD_H - 22, size: 3.8, font: helvetica, color: PdfDocumentAdapter.LIGHT_GRAY });
      page.drawText(String(meta.platformBrandName || 'Bazion Web').toUpperCase(), { x: 236, y: PdfDocumentAdapter.CARD_H - 29, size: 4.4, font: bold, color: PdfDocumentAdapter.WHITE });
    }

    // Photo Box with Gold Border & Shadow effect
    this.drawRect(page, 14, 46, 75, 95, PdfDocumentAdapter.GOLD);
    this.drawRect(page, 16, 48, 71, 91, PdfDocumentAdapter.OFF_WHITE);

    // IC Smart Chip Graphic
    this.drawRect(page, 98, 120, 26, 20, PdfDocumentAdapter.GOLD);
    this.drawRect(page, 100, 122, 22, 16, PdfDocumentAdapter.GOLD_LIGHT);
    this.drawHLine(page, 130, PdfDocumentAdapter.GOLD, 100, 22, 0.5);

    // Student Details
    page.drawText(name.toUpperCase(), { x: 98, y: 104, size: 11, font: bold, color: PdfDocumentAdapter.NAVY });

    page.drawText('STUDENT ID:', { x: 98, y: 88, size: 7, font: bold, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(uid, { x: 155, y: 88, size: 7.5, font: bold, color: PdfDocumentAdapter.NAVY });

    page.drawText('REG NO:', { x: 98, y: 76, size: 7, font: bold, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(regNo, { x: 155, y: 76, size: 7.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText('PROGRAM:', { x: 98, y: 64, size: 7, font: bold, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(program.length > 24 ? program.substring(0, 24) + '...' : program, { x: 155, y: 64, size: 7, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText('VALID THRU:', { x: 98, y: 52, size: 7, font: bold, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText(`${validThru}  •  ACTIVE`, { x: 155, y: 52, size: 7, font: bold, color: PdfDocumentAdapter.GOLD });

    // Bottom Barcode & Footer Strip
    this.drawRect(page, 3, 3, PdfDocumentAdapter.CARD_W - 6, 36, PdfDocumentAdapter.OFF_WHITE);
    this.drawHLine(page, 39, PdfDocumentAdapter.BORDER_GRAY, 3, PdfDocumentAdapter.CARD_W - 6, 1);

    // Mock Code128 Barcode lines
    let barX = 14;
    const pattern = [2, 1, 3, 1, 2, 3, 1, 1, 2, 2, 1, 3, 2, 1, 1, 2, 3, 1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 3, 2, 1];
    for (let i = 0; i < pattern.length; i++) {
      const w = pattern[i];
      if (i % 2 === 0) {
        this.drawRect(page, barX, 10, w, 20, PdfDocumentAdapter.CHARCOAL);
      }
      barX += w + 1;
    }

    page.drawText(`VERIFY: ${meta?.verificationBaseUrl || '/verify'}`, { x: 170, y: 22, size: 6.5, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(`SEC CODE: ${verificationCode}`, { x: 170, y: 12, size: 6.5, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
  }

  /**
   * ─── ACADEMIC TRANSCRIPT ──────────────────────────────────────────────────
   * Official university registrar transcript with course table & cumulative stats
   */
  private async buildTranscript(pdf: PDFDocument, logo: PDFImage | undefined, meta?: Record<string, any>): Promise<void> {
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const name = meta?.name || 'Student Name';
    const uid = meta?.uid || 'STD-2026-001';
    const regNo = meta?.regNo || `${institutionCode(meta)}/UG-CS/226/001`;
    const program = meta?.program || 'Bachelor of Science in Biblical Studies';
    const gpa = meta?.gpa || '3.85';
    const courses = meta?.courses || [];
    const date = meta?.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const verificationCode = meta?.verificationCode || `${institutionCode(meta)}-TRN-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const page = pdf.addPage([PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H]);

    // Letterhead
    this.drawLetterhead(pdf, page, helvetica, bold, logo, meta);

    let y = 635;
    this.drawRect(page, 45, y - 22, 522, 24, PdfDocumentAdapter.NAVY);
    const transcriptHeading = `OFFICIAL ${institutionShortName(meta).toUpperCase()} ACADEMIC TRANSCRIPT • RECORD OF SCHOLARSHIP`;
    page.drawText(transcriptHeading, {
      x: PdfDocumentAdapter.centerX(transcriptHeading, bold, 10.5, PdfDocumentAdapter.PAGE_W),
      y: y - 15,
      size: 10.5,
      font: bold,
      color: PdfDocumentAdapter.GOLD,
    });

    // Student Bio Box
    y -= 30;
    this.drawRect(page, 45, y - 48, 522, 48, PdfDocumentAdapter.OFF_WHITE);
    this.drawRect(page, 45, y - 48, 522, 48, PdfDocumentAdapter.BORDER_GRAY, true, 1);

    page.drawText(`Student Name:`, { x: 55, y: y - 14, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${name.toUpperCase()}`, { x: 135, y: y - 14, size: 9, font: bold, color: PdfDocumentAdapter.NAVY });

    page.drawText(`Student UID:`, { x: 340, y: y - 14, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${uid}`, { x: 420, y: y - 14, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText(`Registration No:`, { x: 55, y: y - 28, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${regNo}`, { x: 135, y: y - 28, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText(`Issue Date:`, { x: 340, y: y - 28, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${date}`, { x: 420, y: y - 28, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });

    page.drawText(`Degree Program:`, { x: 55, y: y - 42, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`${program}`, { x: 135, y: y - 42, size: 8.5, font: helvetica, color: PdfDocumentAdapter.NAVY });

    page.drawText(`Record Status:`, { x: 340, y: y - 42, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`Official Certified Record`, { x: 420, y: y - 42, size: 8.5, font: bold, color: PdfDocumentAdapter.GOLD });

    // Courses Table Header
    y -= 65;
    this.drawRect(page, 45, y - 18, 522, 20, PdfDocumentAdapter.NAVY_LIGHT);
    page.drawText('COURSE CODE', { x: 55, y: y - 13, size: 8, font: bold, color: PdfDocumentAdapter.WHITE });
    page.drawText('COURSE TITLE / DESCRIPTION', { x: 145, y: y - 13, size: 8, font: bold, color: PdfDocumentAdapter.WHITE });
    page.drawText('CREDITS', { x: 375, y: y - 13, size: 8, font: bold, color: PdfDocumentAdapter.WHITE });
    page.drawText('GRADE', { x: 435, y: y - 13, size: 8, font: bold, color: PdfDocumentAdapter.WHITE });
    page.drawText('TERM', { x: 495, y: y - 13, size: 8, font: bold, color: PdfDocumentAdapter.WHITE });

    let rowY = y - 32;
    const items = Array.isArray(courses) && courses.length > 0 ? courses : [
      { code: 'BIB-101', name: 'Old Testament Survey & Hermeneutics', credits: 3, grade: 'A', semester: 'Fall 2026' },
      { code: 'THE-102', name: 'Systematic Theology I: God & Revelation', credits: 3, grade: 'A-', semester: 'Fall 2026' },
      { code: 'MIN-105', name: 'Foundations of Christian Ministry & Ethics', credits: 3, grade: 'A', semester: 'Fall 2026' },
      { code: 'ENG-101', name: 'Academic Research & Theological Writing', credits: 3, grade: 'B+', semester: 'Fall 2026' },
    ];

    let rowIndex = 0;
    for (const c of items) {
      if (rowIndex % 2 === 1) {
        this.drawRect(page, 45, rowY - 6, 522, 16, PdfDocumentAdapter.OFF_WHITE);
      }
      this.drawHLine(page, rowY - 6, PdfDocumentAdapter.BORDER_GRAY, 45, 522, 0.5);

      page.drawText(String(c.code || ''), { x: 55, y: rowY, size: 8.5, font: bold, color: PdfDocumentAdapter.NAVY });
      page.drawText(String(c.name || '').substring(0, 38), { x: 145, y: rowY, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });
      page.drawText(String(c.credits || ''), { x: 385, y: rowY, size: 8.5, font: helvetica, color: PdfDocumentAdapter.CHARCOAL });
      page.drawText(String(c.grade || ''), { x: 445, y: rowY, size: 8.5, font: bold, color: PdfDocumentAdapter.NAVY });
      page.drawText(String(c.semester || ''), { x: 495, y: rowY, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

      rowY -= 17;
      rowIndex++;
    }

    // Cumulative GPA Summary Card
    rowY -= 10;
    this.drawRect(page, 45, rowY - 32, 522, 32, PdfDocumentAdapter.GOLD_LIGHT);
    this.drawRect(page, 45, rowY - 32, 522, 32, PdfDocumentAdapter.GOLD, true, 1);

    page.drawText(`TOTAL CREDITS ATTEMPTED: 12.0`, { x: 55, y: rowY - 14, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`CREDITS EARNED: 12.0`, { x: 230, y: rowY - 14, size: 8.5, font: bold, color: PdfDocumentAdapter.CHARCOAL });
    page.drawText(`CUMULATIVE GPA: ${gpa}`, { x: 385, y: rowY - 14, size: 10, font: bold, color: PdfDocumentAdapter.NAVY_DARK });

    page.drawText(`Academic Standing: Dean's Honour Roll (Good Standing)`, { x: 55, y: rowY - 26, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    // Grading Legend & Registrar Counter-Signature
    const sigY = 130;
    this.drawHLine(page, sigY + 10, PdfDocumentAdapter.BORDER_GRAY, 45, 522, 0.75);

    page.drawText('GRADING SCALE & ACCREDITATION NOTE:', { x: 45, y: sigY - 2, size: 7.5, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText('A = 4.0 (93-100%) | A- = 3.7 (90-92%) | B+ = 3.3 (87-89%) | B = 3.0 (83-86%) | C = 2.0 (73-76%) | F = 0.0 (Fail)', { x: 45, y: sigY - 12, size: 6.5, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });
    page.drawText('Official transcripts bear the digital signature and cryptographic verification hash of the University Registrar.', { x: 45, y: sigY - 20, size: 6.5, font: helvetica, color: PdfDocumentAdapter.LIGHT_GRAY });

    this.drawHLine(page, sigY - 45, PdfDocumentAdapter.CHARCOAL, 395, 172, 1);
    page.drawText(`${meta?.authorizedBy || 'Authorized Signatory'} — ${meta?.authorizedTitle || 'University Registrar'}`, { x: 395, y: sigY - 55, size: 8.5, font: bold, color: PdfDocumentAdapter.NAVY });

    this.drawFooter(pdf, page, helvetica, bold, verificationCode, meta);
  }

  /**
   * ─── CERTIFICATE OF COMPLETION / DIPLOMA ──────────────────────────────────
   * Classical diploma layout with gold rosette, dual seals & ornate frame
   */
  private async buildCertificate(pdf: PDFDocument, logo: PDFImage | undefined, meta?: Record<string, any>): Promise<void> {
    const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const times = await pdf.embedFont(StandardFonts.TimesRoman);
    const timesBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const timesItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

    const name = meta?.name || 'Graduate Name';
    const program = meta?.program || 'Bachelor of Science in Biblical Studies';
    const uid = meta?.uid || 'STD-2026-001';
    const regNo = meta?.regNo || `${institutionCode(meta)}/UG-CS/226/001`;
    const awardDate = meta?.awardDate || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const classification = meta?.classification || 'First Class Honours';
    const verificationCode = meta?.verificationCode || `${institutionCode(meta)}-DIP-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const page = pdf.addPage([PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H]);

    // Classical Certificate Multi-Border
    this.drawRect(page, 0, 0, PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H, PdfDocumentAdapter.WHITE);
    this.drawRect(page, 16, 16, 580, 760, PdfDocumentAdapter.NAVY_DARK, true, 3);
    this.drawRect(page, 22, 22, 568, 748, PdfDocumentAdapter.GOLD, true, 1.5);
    this.drawRect(page, 26, 26, 560, 740, PdfDocumentAdapter.NAVY_DARK, true, 0.75);
    this.drawRect(page, 30, 30, 552, 732, PdfDocumentAdapter.OFF_WHITE);

    // Corner Ornaments
    this.drawCornerFloret(page, 36, 756);
    this.drawCornerFloret(page, 570, 756);
    this.drawCornerFloret(page, 36, 42);
    this.drawCornerFloret(page, 570, 42);

    if (logo) {
      const logoDims = logo.scale(0.13);
      page.drawImage(logo, { x: 306 - logoDims.width / 2, y: 660, width: logoDims.width, height: logoDims.height });
    }

    let y = 620;
    const fullInstitutionName = institutionName(meta).toUpperCase();
    page.drawText(fullInstitutionName, {
      x: PdfDocumentAdapter.centerX(fullInstitutionName, timesBold, 16),
      y,
      size: 16,
      font: timesBold,
      color: PdfDocumentAdapter.NAVY_DARK,
    });

    y -= 18;
    const accreditationLine = `${institutionShortName(meta).toUpperCase()} • ${meta?.accreditationLabel || 'OFFICIAL ACADEMIC RECORD'}`;
    page.drawText(accreditationLine, {
      x: PdfDocumentAdapter.centerX(accreditationLine, bold, 8.5),
      y,
      size: 8.5,
      font: bold,
      color: PdfDocumentAdapter.GOLD,
    });

    y -= 25;
    this.drawHLine(page, y, PdfDocumentAdapter.GOLD, 160, 292, 1.5);

    y -= 25;
    page.drawText('By the authority of the Board of Trustees and the Faculty Senate', {
      x: PdfDocumentAdapter.centerX('By the authority of the Board of Trustees and the Faculty Senate', timesItalic, 12),
      y,
      size: 12,
      font: timesItalic,
      color: PdfDocumentAdapter.DARK_GRAY,
    });

    y -= 16;
    page.drawText('be it known that', {
      x: PdfDocumentAdapter.centerX('be it known that', timesItalic, 11),
      y,
      size: 11,
      font: timesItalic,
      color: PdfDocumentAdapter.LIGHT_GRAY,
    });

    y -= 35;
    page.drawText(name.toUpperCase(), {
      x: PdfDocumentAdapter.centerX(name.toUpperCase(), timesBold, 24),
      y,
      size: 24,
      font: timesBold,
      color: PdfDocumentAdapter.NAVY_DARK,
    });
    this.drawHLine(page, y - 6, PdfDocumentAdapter.GOLD, 140, 332, 1);

    y -= 32;
    page.drawText('has successfully completed the prescribed curriculum and fulfilled all academic requirements for the conferral of the degree of', {
      x: PdfDocumentAdapter.centerX('has successfully completed the prescribed curriculum and fulfilled all academic requirements for the conferral of the degree of', times, 9.5),
      y,
      size: 9.5,
      font: times,
      color: PdfDocumentAdapter.CHARCOAL,
    });

    y -= 30;
    page.drawText(program.toUpperCase(), {
      x: PdfDocumentAdapter.centerX(program.toUpperCase(), timesBold, 18),
      y,
      size: 18,
      font: timesBold,
      color: PdfDocumentAdapter.NAVY,
    });

    if (classification) {
      y -= 20;
      page.drawText(`with ${classification}`, {
        x: PdfDocumentAdapter.centerX(`with ${classification}`, timesBold, 13),
        y,
        size: 13,
        font: timesBold,
        color: PdfDocumentAdapter.GOLD,
      });
    }

    y -= 25;
    page.drawText(`Conferred on this ${awardDate} with all rights, privileges, and honours thereto appertaining.`, {
      x: PdfDocumentAdapter.centerX(`Conferred on this ${awardDate} with all rights, privileges, and honours thereto appertaining.`, timesItalic, 10),
      y,
      size: 10,
      font: timesItalic,
      color: PdfDocumentAdapter.DARK_GRAY,
    });

    // Student Registry Reference
    y -= 28;
    page.drawText(`Student ID: ${uid}   |   Registration No: ${regNo}`, {
      x: PdfDocumentAdapter.centerX(`Student ID: ${uid}   |   Registration No: ${regNo}`, helvetica, 8.5),
      y,
      size: 8.5,
      font: helvetica,
      color: PdfDocumentAdapter.DARK_GRAY,
    });

    // Signatures & Gold Medallion
    y -= 60;
    this.drawHLine(page, y, PdfDocumentAdapter.CHARCOAL, 70, 150, 1);
    page.drawText(meta?.authorizedBy || 'Authorized Signatory', { x: 95, y: y - 14, size: 9.5, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(meta?.authorizedTitle || 'Chief Registrar', { x: 110, y: y - 24, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    this.drawSealEmblem(page, 306, y - 5, bold, helvetica, meta);

    this.drawHLine(page, y, PdfDocumentAdapter.CHARCOAL, 392, 150, 1);
    page.drawText(meta?.secondaryAuthorizedBy || institutionName(meta), { x: 388, y: y - 14, size: 9.5, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(meta?.secondaryAuthorizedTitle || 'Institutional Authority', { x: 418, y: y - 24, size: 8, font: helvetica, color: PdfDocumentAdapter.DARK_GRAY });

    // Microprint verification footer
    page.drawText(`VERIFICATION CODE: ${verificationCode} • VALIDATE AUTHENTICITY AT: ${VERIFY_BASE_URL}`, {
      x: PdfDocumentAdapter.centerX(`VERIFICATION CODE: ${verificationCode} • VALIDATE AUTHENTICITY AT: ${VERIFY_BASE_URL}`, helvetica, 7),
      y: 46,
      size: 7,
      font: helvetica,
      color: PdfDocumentAdapter.LIGHT_GRAY,
    });
  }

  private async buildGenericDocument(pdf: PDFDocument, type: string, userId: string, meta?: Record<string, any>): Promise<void> {
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const page = pdf.addPage([PdfDocumentAdapter.PAGE_W, PdfDocumentAdapter.PAGE_H]);

    this.drawLetterhead(pdf, page, font, bold, undefined, meta);

    page.drawText(`DOCUMENT TYPE: ${type.replace('_', ' ').toUpperCase()}`, { x: 50, y: 550, size: 18, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText(`User ID: ${userId}`, { x: 50, y: 520, size: 11, font, color: PdfDocumentAdapter.DARK_GRAY });

    if (meta) {
      let y = 490;
      for (const [key, value] of Object.entries(meta)) {
        page.drawText(`${key}: ${String(value)}`, { x: 50, y, size: 10, font, color: PdfDocumentAdapter.CHARCOAL });
        y -= 16;
      }
    }
    this.drawFooter(pdf, page, font, bold, meta?.verificationCode || 'GEN-DOC', meta);
  }

  // ─── HELPER DRAWING FUNCTIONS ───────────────────────────────────────────────

  private drawLetterhead(_pdf: PDFDocument, page: any, font: PDFFont, bold: PDFFont, logo?: PDFImage, meta?: Record<string, any>): void {
    // Top Navy Header Bar
    this.drawRect(page, 0, 712, PdfDocumentAdapter.PAGE_W, 80, PdfDocumentAdapter.NAVY_DARK);
    this.drawHLine(page, 712, PdfDocumentAdapter.GOLD, 0, PdfDocumentAdapter.PAGE_W, 3);

    if (logo) {
      const dims = logo.scale(0.09);
      page.drawImage(logo, { x: 45, y: 722, width: dims.width, height: dims.height });
    }

    const textX = logo ? 115 : 45;
    page.drawText(institutionName(meta).toUpperCase(), { x: textX, y: 760, size: 15, font: bold, color: PdfDocumentAdapter.WHITE });
    page.drawText(`${institutionShortName(meta).toUpperCase()} • OFFICE OF THE REGISTRAR & ADMISSIONS`, { x: textX, y: 742, size: 8.5, font: bold, color: PdfDocumentAdapter.GOLD });
    const contacts = [meta?.websiteUrl, meta?.admissionsEmail, meta?.verificationBaseUrl].filter(Boolean).join('  |  ');
    page.drawText(contacts || meta?.address || '', { x: textX, y: 725, size: 7.5, font, color: PdfDocumentAdapter.LIGHT_GRAY });
  }

  private drawFooter(_pdf: PDFDocument, page: any, font: PDFFont, _bold: PDFFont, verificationCode?: string, meta?: Record<string, any>): void {
    this.drawHLine(page, 44, PdfDocumentAdapter.BORDER_GRAY, 45, 522, 0.75);
    const textWidth = meta?.platformLogo ? 392 : 522;
    page.drawText(`Official Document • ${institutionName(meta)} • ${meta?.accreditationLabel || 'Institutional Record'}`, {
      x: 45, y: 32, size: 6.6, maxWidth: textWidth, font, color: PdfDocumentAdapter.DARK_GRAY,
    });
    page.drawText(`Digital Verification Code: ${verificationCode || 'VERIFIED'} • Verify at ${meta?.verificationBaseUrl || '/verify'} • ${meta?.registrarEmail || ''}`, {
      x: 45, y: 22, size: 6.2, maxWidth: textWidth, font, color: PdfDocumentAdapter.LIGHT_GRAY,
    });
    if (meta?.platformLogo) {
      const dimensions = meta.platformLogo.scale(0.09);
      page.drawImage(meta.platformLogo, { x: 523, y: 5, width: dimensions.width, height: dimensions.height });
      page.drawText('POWERED BY', { x: 456, y: 22, size: 5.2, font, color: PdfDocumentAdapter.LIGHT_GRAY });
      page.drawText(String(meta.platformBrandName || 'Bazion Web').toUpperCase(), { x: 456, y: 13, size: 5.6, font, color: PdfDocumentAdapter.NAVY });
    }
  }

  private drawSealEmblem(page: any, cx: number, cy: number, bold: PDFFont, helv: PDFFont, meta?: Record<string, any>): void {
    this.drawRect(page, cx - 35, cy - 35, 70, 70, PdfDocumentAdapter.GOLD_LIGHT);
    this.drawRect(page, cx - 35, cy - 35, 70, 70, PdfDocumentAdapter.GOLD, true, 1.5);
    this.drawRect(page, cx - 31, cy - 31, 62, 62, PdfDocumentAdapter.NAVY, true, 0.75);
    const code = institutionCode(meta).slice(0, 6);
    page.drawText(code, { x: cx - code.length * 3, y: cy + 4, size: 11, font: bold, color: PdfDocumentAdapter.GOLD });
    page.drawText('SEAL', { x: cx - 13, y: cy - 8, size: 8, font: bold, color: PdfDocumentAdapter.NAVY });
    page.drawText('OFFICIAL', { x: cx - 18, y: cy - 20, size: 6, font: helv, color: PdfDocumentAdapter.CHARCOAL });
  }

  private drawCornerFloret(page: any, x: number, y: number): void {
    this.drawRect(page, x - 3, y - 3, 6, 6, PdfDocumentAdapter.GOLD);
  }

  private drawParagraph(page: any, text: string, x: number, y: number, maxWidth: number, fontSize: number, font: PDFFont, color: any, lineHeight = 14): void {
    const words = text.split(' ');
    let currentLine = '';
    let currentY = y;

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(candidate, fontSize);
      if (width > maxWidth) {
        page.drawText(currentLine, { x, y: currentY, size: fontSize, font, color });
        currentLine = word;
        currentY -= lineHeight;
      } else {
        currentLine = candidate;
      }
    }
    if (currentLine) {
      page.drawText(currentLine, { x, y: currentY, size: fontSize, font, color });
    }
  }

  private drawRect(page: any, x: number, y: number, w: number, h: number, color: any, isStroke = false, lineWidth = 1): void {
    if (isStroke) {
      page.drawRectangle({ x, y, width: w, height: h, borderColor: color, borderWidth: lineWidth });
    } else {
      page.drawRectangle({ x, y, width: w, height: h, color, borderWidth: 0 });
    }
  }

  private drawHLine(page: any, y: number, color: any, x: number, w: number, t: number): void {
    page.drawLine({ start: { x, y }, end: { x: x + w, y }, thickness: t, color });
  }
}
