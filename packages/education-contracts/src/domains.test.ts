import { describe, it, expect } from 'vitest';
import {
  PORTAL_URL,
  UMS_URL,
  MARKETING_URL,
  MARKETING_URL_WWW,
  API_WORKER_URL,
  VERIFY_URL,
  ADMIN_URL,
  APPLY_URL,
  ALLOWED_ORIGINS,
  ADMISSIONS_EMAIL,
  REGISTRAR_EMAIL,
  ADMIN_EMAIL,
  SUPPORT_EMAIL,
  NOREPLY_EMAIL,
  SECURITY_EMAIL,
  FINANCE_EMAIL,
  ALUMNI_EMAIL,
} from '../src/domains.js';

describe('@bmi/shared — domains', () => {
  it('PORTAL_URL is the expected production URL', () => {
    expect(PORTAL_URL).toBe('https://portal.bmiuniversities.org');
  });

  it('UMS_URL is the expected production URL', () => {
    expect(UMS_URL).toBe('https://ums.bmiuniversities.org');
  });

  it('MARKETING_URL is the expected production URL', () => {
    expect(MARKETING_URL).toBe('https://bmiuniversities.org');
  });

  it('MARKETING_URL_WWW includes www prefix', () => {
    expect(MARKETING_URL_WWW).toBe('https://www.bmiuniversities.org');
  });

  it('API_WORKER_URL is the canonical API gateway', () => {
    expect(API_WORKER_URL).toBe('https://api.bmiuniversities.org');
  });

  it('all institutional emails are valid email addresses', () => {
    const emails = [
      ADMISSIONS_EMAIL,
      REGISTRAR_EMAIL,
      ADMIN_EMAIL,
      SUPPORT_EMAIL,
      NOREPLY_EMAIL,
      SECURITY_EMAIL,
      FINANCE_EMAIL,
      ALUMNI_EMAIL,
    ];
    for (const email of emails) {
      expect(email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(email.endsWith('@bmiuniversities.org')).toBe(true);
    }
  });

  it('ALLOWED_ORIGINS includes all expected canonical origins and subdomains', () => {
    expect(ALLOWED_ORIGINS).toContain('https://bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://www.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://portal.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://ums.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://api.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://verify.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://admin.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://apply.bmiuniversities.org');
    expect(ALLOWED_ORIGINS).toContain('https://bmi-portal.pages.dev');
    expect(ALLOWED_ORIGINS).toContain('https://bmi-ums.pages.dev');
    expect(ALLOWED_ORIGINS).toContain('https://bmi-university.pages.dev');
    expect(ALLOWED_ORIGINS).toContain('http://localhost:5173');
    expect(ALLOWED_ORIGINS).toContain('http://localhost:3000');
    expect(ALLOWED_ORIGINS).toContain('http://localhost:4173');
    expect(ALLOWED_ORIGINS).toContain('http://localhost:5174');
    expect(ALLOWED_ORIGINS).toContain('http://127.0.0.1:8787');
  });

  it('ALLOWED_ORIGINS has no duplicates', () => {
    const unique = new Set(ALLOWED_ORIGINS);
    expect(unique.size).toBe(ALLOWED_ORIGINS.length);
  });

  it('all ALLOWED_ORIGINS start with http:// or https://', () => {
    for (const origin of ALLOWED_ORIGINS) {
      expect(origin).toMatch(/^https?:\/\//);
    }
  });

  it('snapshot — allowed origins list has not changed (domain drift guard)', () => {
    expect(ALLOWED_ORIGINS).toMatchSnapshot();
  });
});
