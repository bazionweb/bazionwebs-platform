import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

const generateCertHash = (studentId: string, courseCode: string): string => {
  return crypto.createHash('sha256').update(`${studentId}:${courseCode}`).digest('hex');
};

describe('certificate tests', () => {
  it('deterministic 64-char hex hash', () => {
    const hash = generateCertHash('STU001', 'THE101');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('same inputs = same hash', () => {
    expect(generateCertHash('A', 'B')).toBe(generateCertHash('A', 'B'));
  });

  it('different studentId = different hash', () => {
    expect(generateCertHash('A', 'B')).not.toBe(generateCertHash('C', 'B'));
  });

  it('different courseCode = different hash', () => {
    expect(generateCertHash('A', 'B')).not.toBe(generateCertHash('A', 'C'));
  });
});





