import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfDocumentAdapter } from './PdfDocumentAdapter';
import { PDFDocument } from '../../shims/external-adapters';

describe('PdfDocumentAdapter', () => {
  let adapter: PdfDocumentAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new PdfDocumentAdapter();
  });

  describe('generateDocument', () => {
    const baseRequest = {
      type: 'admission_letter' as const,
      userId: 'user-123',
      metadata: {
        name: 'Jane Doe',
        program: 'BSc Computer Science',
        regNo: 'REG-001',
      },
    };

    it('returns a Document with correct shape for admission_letter', async () => {
      const doc = await adapter.generateDocument(baseRequest);

      expect(doc).toMatchObject({
        id: expect.any(String),
        type: 'admission_letter',
        userId: 'user-123',
        status: 'ready',
        verificationCode: expect.any(String),
      });
      expect(doc.createdAt).toBeInstanceOf(Date);
      expect(doc.data).toBeInstanceOf(Buffer);
      expect(doc.data.length).toBeGreaterThan(100);
    });

    it('generates valid PDF bytes for admission_letter', async () => {
      const doc = await adapter.generateDocument(baseRequest);
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates a valid PDF for enrollment_letter', async () => {
      const doc = await adapter.generateDocument({
        ...baseRequest,
        type: 'enrollment_letter',
        metadata: { name: 'Jane Doe', program: 'BSc CS', uid: 'S-001', regNo: 'REG-001' },
      });
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates a valid PDF for id_card', async () => {
      const doc = await adapter.generateDocument({
        ...baseRequest,
        type: 'id_card',
        metadata: { name: 'Jane Doe', uid: 'S-001', regNo: 'REG-001', program: 'BSc CS' },
      });
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates a valid PDF for transcript', async () => {
      const doc = await adapter.generateDocument({
        ...baseRequest,
        type: 'transcript',
        metadata: {
          name: 'Jane Doe', uid: 'S-001', regNo: 'REG-001',
          program: 'BSc CS', gpa: '3.8',
          courses: [{ code: 'CS101', name: 'Intro', credits: 3, grade: 'A', semester: '2025A' }],
        },
      });
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates a valid PDF for certificate', async () => {
      const doc = await adapter.generateDocument({
        ...baseRequest,
        type: 'certificate',
        metadata: {
          name: 'Jane Doe', program: 'BSc CS', uid: 'S-001', regNo: 'REG-001',
          awardDate: '2026-05-20', classification: 'First Class',
        },
      });
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates a valid PDF for unknown type (generic)', async () => {
      const doc = await adapter.generateDocument({
        ...baseRequest,
        type: 'good_standing' as any,
        metadata: { status: 'Active' },
      });
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('handles logo fetch failure gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

      const doc = await adapter.generateDocument(baseRequest);
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('embeds logo when fetch succeeds', async () => {
      // Create a minimal valid PNG (1x1 pixel)
      const minimalPng = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixels
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // grayscale
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0x60, 0x60, 0x00, 0x00, // (compressed data)
        0x00, 0x02, 0x00, 0x01, 0x58, 0x7A, 0x7B, 0x5F, // (partial)
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND chunk
        0xAE, 0x42, 0x60, 0x82,
      ]);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(minimalPng.buffer),
      } as any);

      const doc = await adapter.generateDocument(baseRequest);
      const pdf = await PDFDocument.load(doc.data);
      expect(pdf.getPageCount()).toBe(1);
    });

    it('generates unique IDs for each document', async () => {
      const doc1 = await adapter.generateDocument(baseRequest);
      const doc2 = await adapter.generateDocument(baseRequest);

      expect(doc1.id).not.toBe(doc2.id);
      expect(doc1.verificationCode).not.toBe(doc2.verificationCode);
    });
  });

  describe('getDocument', () => {
    it('returns null', async () => {
      const result = await adapter.getDocument('any-id');
      expect(result).toBeNull();
    });
  });

  describe('getDocumentsByUser', () => {
    it('returns empty array', async () => {
      const result = await adapter.getDocumentsByUser('user-123');
      expect(result).toEqual([]);
    });
  });

  describe('verifyDocument', () => {
    it('returns null', async () => {
      const result = await adapter.verifyDocument('any-code');
      expect(result).toBeNull();
    });
  });
});
