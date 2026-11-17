import { describe, it, expect } from 'vitest';
import {
  validateEmail,
  validatePassword,
  getPasswordStrength,
  getPasswordStrengthInfo,
} from './registrationValidation';

describe('registrationValidation', () => {
  describe('validateEmail', () => {
    it('returns true for valid email addresses', () => {
      expect(validateEmail('john.doe@example.com')).toBe(true);
      expect(validateEmail('user@church.org')).toBe(true);
      expect(validateEmail('admin.user+tag@domain.co.uk')).toBe(true);
    });

    it('returns false for invalid email addresses', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('user@domain..com')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('validates password criteria correctly', () => {
      const result = validatePassword('StrongPass123!');
      expect(result.minLength).toBe(true);
      expect(result.hasUppercase).toBe(true);
      expect(result.hasLowercase).toBe(true);
      expect(result.hasNumber).toBe(true);
      expect(result.hasSpecialChar).toBe(true);
      expect(result.noCommonPatterns).toBe(true);
    });

    it('detects common passwords', () => {
      const result = validatePassword('password123');
      expect(result.noCommonPatterns).toBe(false);
    });

    it('fails short passwords', () => {
      const result = validatePassword('Short1!');
      expect(result.minLength).toBe(false);
    });
  });

  describe('getPasswordStrength & getPasswordStrengthInfo', () => {
    it('calculates score percentage correctly', () => {
      const fullCriteria = {
        minLength: true,
        hasUppercase: true,
        hasLowercase: true,
        hasNumber: true,
        hasSpecialChar: true,
        noCommonPatterns: true,
      };
      expect(getPasswordStrength(fullCriteria)).toBe(100);
      expect(getPasswordStrengthInfo(100).label).toBe('Strong');

      const weakCriteria = {
        minLength: false,
        hasUppercase: false,
        hasLowercase: true,
        hasNumber: false,
        hasSpecialChar: false,
        noCommonPatterns: true,
      };
      expect(getPasswordStrength(weakCriteria)).toBe(33);
      expect(getPasswordStrengthInfo(33).label).toBe('Weak');
    });
  });
});
