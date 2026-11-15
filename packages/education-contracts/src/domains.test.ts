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
  BMI_UNIVERSITY_TENANT_ID,
  BEMI_INSTITUTE_TENANT_ID,
  BMI_LEGACY_TENANT_ID,
  BEMI_LEGACY_TENANT_ID,
  isBmiHost,
  isBemiHost,
  isEducationHost,
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

  it('correctly matches BMI hosts across production and dev domains', () => {
    expect(isBmiHost('bmi.ac.ke')).toBe(true);
    expect(isBmiHost('www.bmi.ac.ke')).toBe(true);
    expect(isBmiHost('university.bmi.ac.ke')).toBe(true);
    expect(isBmiHost('portal.bmi.ac.ke')).toBe(true);
    expect(isBmiHost('bmiuniversities.org')).toBe(true);
    expect(isBmiHost('bmi.localhost:3100')).toBe(true);
    expect(isBmiHost('bmi-university.localhost')).toBe(true);
    expect(isBmiHost('bemi.org')).toBe(false);
    expect(isBmiHost('bemi.localhost:3100')).toBe(false);
    expect(isBmiHost('localhost:3100')).toBe(false);
    expect(isBmiHost('church.bazion.com')).toBe(false);
  });

  it('correctly matches BEMI hosts across production and dev domains', () => {
    expect(isBemiHost('bemi.org')).toBe(true);
    expect(isBemiHost('www.bemi.org')).toBe(true);
    expect(isBemiHost('institute.bemi.org')).toBe(true);
    expect(isBemiHost('bemi.ac.ke')).toBe(true);
    expect(isBemiHost('bemi.localhost:3100')).toBe(true);
    expect(isBemiHost('bemi-institute.localhost')).toBe(true);
    expect(isBemiHost('bmi.ac.ke')).toBe(false);
    expect(isBemiHost('bmi.localhost:3100')).toBe(false);
    expect(isBemiHost('localhost:3100')).toBe(false);
  });

  it('exports canonical tenant IDs for BMI and BEMI', () => {
    expect(BMI_UNIVERSITY_TENANT_ID).toBe('00000000-0000-4000-8000-000000000055');
    expect(BEMI_INSTITUTE_TENANT_ID).toBe('00000000-0000-4000-8000-000000000056');
    expect(BMI_LEGACY_TENANT_ID).toBe('b1000000-0000-4000-8000-000000000001');
    expect(BEMI_LEGACY_TENANT_ID).toBe('b2000000-0000-4000-8000-000000000002');
  });
});
