import { describe, it, expect } from 'vitest';

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidStudentId = (id: string) => /^STU-\d{4}-\d+$/.test(id);
const stripXSS = (html: string) => html.replace(/<script.*?>.*?<\/script>/gi, '');

describe('validation tests', () => {
  it('valid email accepted', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
  });

  it('malformed email rejected', () => {
    expect(isValidEmail('invalid-email')).toBe(false);
  });

  it('valid student ID format accepted', () => {
    expect(isValidStudentId('STU-2024-001')).toBe(true);
  });

  it('invalid student ID rejected', () => {
    expect(isValidStudentId('12345')).toBe(false);
  });

  it('XSS script tag stripped', () => {
    expect(stripXSS('hello <script>alert(1)</script>')).toBe('hello ');
  });
});





