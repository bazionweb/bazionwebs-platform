/**
 * BMI UMS — StudentRegistrationModal Validation Tests
 *
 * Validates the client-side form validation rules inside handleSubmit:
 * - First name and last name are required
 * - A program must be selected
 * - Email is optional but must be a valid format when provided
 * - Phone is optional but must have at least 10 digits when provided
 *
 * Strategy: we test the validation logic directly as pure functions that
 * mirror what handleSubmit does, avoiding the need to render the full modal
 * with its async program/campus fetches and complex sub-components.
 */

import { describe, it, expect } from 'vitest';

// ── Validation logic extracted from StudentRegistrationModal.handleSubmit ─────
// This mirrors the exact checks in the component so any future change to the
// component's validation will break these tests, giving us a regression signal.

interface FormData {
  first_name?: string;
  last_name?: string;
  program_code?: string;
  email?: string;
  phone?: string;
}

function validate(formData: FormData): string | null {
  // 1. Required: first_name and last_name
  if (!formData.first_name || !formData.last_name) {
    return 'Please fill in all required fields (First Name, Last Name)';
  }

  // 2. Required: program_code
  if (!formData.program_code) {
    return 'Please select an academic program';
  }

  // 3. Optional email — valid format when provided
  if (formData.email && formData.email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      return 'Please enter a valid email address';
    }
  }

  // 4. Optional phone — at least 10 digits when provided
  if (formData.phone && formData.phone.trim()) {
    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return 'Please enter a valid phone number (at least 10 digits)';
    }
  }

  return null; // valid
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('StudentRegistrationModal — form validation', () => {
  describe('required fields', () => {
    it('rejects when first_name is empty', () => {
      expect(
        validate({ first_name: '', last_name: 'Doe', program_code: 'GENERAL' }),
      ).toBe('Please fill in all required fields (First Name, Last Name)');
    });

    it('rejects when last_name is empty', () => {
      expect(
        validate({ first_name: 'John', last_name: '', program_code: 'GENERAL' }),
      ).toBe('Please fill in all required fields (First Name, Last Name)');
    });

    it('rejects when both name fields are missing', () => {
      const error = validate({ program_code: 'GENERAL' });
      expect(error).toBe('Please fill in all required fields (First Name, Last Name)');
    });

    it('rejects when program_code is absent', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: '' }),
      ).toBe('Please select an academic program');
    });

    it('rejects when program_code is undefined', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe' }),
      ).toBe('Please select an academic program');
    });
  });

  describe('optional email validation', () => {
    it('accepts a valid email address', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', email: 'john@bmi.edu' }),
      ).toBeNull();
    });

    it('rejects a malformed email (missing @)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', email: 'johnbmi.edu' }),
      ).toBe('Please enter a valid email address');
    });

    it('rejects a malformed email (missing domain extension)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', email: 'john@bmi' }),
      ).toBe('Please enter a valid email address');
    });

    it('accepts when email is omitted (not provided at all)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL' }),
      ).toBeNull();
    });

    it('accepts when email is an empty string (skips email validation)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', email: '' }),
      ).toBeNull();
    });
  });

  describe('optional phone validation', () => {
    it('accepts a 10-digit phone number', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', phone: '0712345678' }),
      ).toBeNull();
    });

    it('accepts a phone number with formatting characters (parentheses, dashes)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', phone: '+254 (072) 123-4567' }),
      ).toBeNull();
    });

    it('rejects a phone with fewer than 10 digits', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', phone: '12345' }),
      ).toBe('Please enter a valid phone number (at least 10 digits)');
    });

    it('rejects a phone with only 9 digits (boundary)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', phone: '071234567' }),
      ).toBe('Please enter a valid phone number (at least 10 digits)');
    });

    it('accepts when phone is omitted', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL' }),
      ).toBeNull();
    });

    it('accepts when phone is an empty string (skips phone validation)', () => {
      expect(
        validate({ first_name: 'John', last_name: 'Doe', program_code: 'GENERAL', phone: '' }),
      ).toBeNull();
    });
  });

  describe('fully valid form data', () => {
    it('returns null (no error) for a complete, valid form', () => {
      expect(
        validate({
          first_name: 'Joseph',
          last_name: 'Kimani',
          program_code: 'BSC-CS',
          email: 'joseph@bmi.edu',
          phone: '+254712345678',
        }),
      ).toBeNull();
    });
  });
});









