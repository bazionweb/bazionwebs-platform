export interface PasswordCriteria {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  noCommonPatterns: boolean;
}

export const COMMON_PASSWORDS = [
  'password',
  '123456',
  '123456789',
  'qwerty',
  'abc123',
  'password123',
  'admin',
  'letmein',
  'welcome',
  'monkey',
  '1234567890',
  'password1',
];

export const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isValid = emailRegex.test(email);
  const hasValidDomain = !email.includes('..') && !email.startsWith('.') && !email.endsWith('.');
  return isValid && hasValidDomain;
};

export const validatePassword = (password: string): PasswordCriteria => {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    noCommonPatterns: !COMMON_PASSWORDS.some((common) => password.toLowerCase().includes(common.toLowerCase())),
  };
};

export const getPasswordStrength = (criteria: PasswordCriteria): number => {
  const score = Object.values(criteria).filter(Boolean).length;
  return Math.round((score / 6) * 100);
};

export interface PasswordStrengthInfo {
  color: string;
  bg: string;
  label: string;
  barColor: string;
}

export const getPasswordStrengthInfo = (score: number): PasswordStrengthInfo => {
  if (score < 50) return { color: 'text-red-600', bg: 'bg-red-100', label: 'Weak', barColor: 'bg-red-500' };
  if (score < 75) return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Fair', barColor: 'bg-yellow-500' };
  if (score < 90) return { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Good', barColor: 'bg-blue-500' };
  return { color: 'text-green-600', bg: 'bg-green-100', label: 'Strong', barColor: 'bg-green-500' };
};
