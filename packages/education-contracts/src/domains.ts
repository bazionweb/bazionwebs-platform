/**
 * @bmi/shared — Domain Constants
 *
 * Canonical URLs, origins, and contact information for BMI University.
 * Import these constants instead of hardcoding domain strings.
 */

/** The public URL of the admissions / student portal. */
export const PORTAL_URL = 'https://portal.bmiuniversities.org' as const;

/** The public URL of the University Management System (internal staff & students). */
export const UMS_URL = 'https://ums.bmiuniversities.org' as const;

/** The public URL of the marketing / university website. */
export const MARKETING_URL = 'https://bmiuniversities.org' as const;

/** The www-prefixed URL of the marketing site. */
export const MARKETING_URL_WWW = 'https://www.bmiuniversities.org' as const;

/** The canonical production URL of the backend API Gateway / Worker. */
export const API_WORKER_URL = 'https://api.bmiuniversities.org' as const;

/** The canonical origin for public document & credential verification. */
export const VERIFY_URL = 'https://verify.bmiuniversities.org' as const;

/** The direct web path for public document & credential verification. */
export const VERIFY_PAGE_URL = 'https://bmiuniversities.org/verify' as const;

/** The administrative portal URL. */
export const ADMIN_URL = 'https://admin.bmiuniversities.org' as const;

/** The direct application URL. */
export const APPLY_URL = 'https://apply.bmiuniversities.org' as const;

/** The Cloudflare Pages fallback URL of the portal. */
export const PORTAL_PAGES_URL = 'https://bmi-portal.pages.dev' as const;

/** The Cloudflare Pages fallback URL of the UMS frontend. */
export const UMS_PAGES_URL = 'https://bmi-ums.pages.dev' as const;

/** The Cloudflare Pages fallback URL of the marketing website. */
export const UNIVERSITY_PAGES_URL = 'https://bmi-university.pages.dev' as const;

/** Local development URLs — always included in allowed origins. */
export const DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  // UMS dev & preview port (see apps/ums/vite.config.ts)
  'http://localhost:5174',
  'http://127.0.0.1:8787',
] as const;

/**
 * Full list of CORS-allowed origins for the unified API worker.
 * Covers the Marketing Site, Admissions Portal, and UMS frontend across
 * canonical custom domains and production Cloudflare Pages aliases.
 */
export const ALLOWED_ORIGINS: string[] = [
  MARKETING_URL,
  MARKETING_URL_WWW,
  PORTAL_URL,
  UMS_URL,
  API_WORKER_URL,
  VERIFY_URL,
  ADMIN_URL,
  APPLY_URL,
  PORTAL_PAGES_URL,
  UMS_PAGES_URL,
  UNIVERSITY_PAGES_URL,
  // Cloudflare Pages deployment branches
  'https://portal.bmi-university.pages.dev',
  'https://ums.bmi-university.pages.dev',
  'https://main.bmi-university.pages.dev',
  ...DEV_ORIGINS,
];

/** The primary admissions contact email address. */
export const ADMISSIONS_EMAIL = 'admissions@bmiuniversities.org' as const;

/** The registrar's office contact email address. */
export const REGISTRAR_EMAIL = 'registrar@bmiuniversities.org' as const;

/** The admin contact email address. */
export const ADMIN_EMAIL = 'admin@bmiuniversities.org' as const;

/** The technical support contact email address. */
export const SUPPORT_EMAIL = 'support@bmiuniversities.org' as const;

/** The transactional notifications sender email address. */
export const NOREPLY_EMAIL = 'noreply@bmiuniversities.org' as const;

/** The security & vulnerability reporting email address. */
export const SECURITY_EMAIL = 'security@bmiuniversities.org' as const;

/** The student finance & billing email address. */
export const FINANCE_EMAIL = 'finance@bmiuniversities.org' as const;

/** The alumni network contact email address. */
export const ALUMNI_EMAIL = 'alumni@bmiuniversities.org' as const;

/** Canonical Tenant IDs for education organizations */
export const BMI_UNIVERSITY_TENANT_ID = '00000000-0000-4000-8000-000000000055' as const;
export const BEMI_INSTITUTE_TENANT_ID = '00000000-0000-4000-8000-000000000056' as const;
export const BMI_LEGACY_TENANT_ID = 'b1000000-0000-4000-8000-000000000001' as const;
export const BEMI_LEGACY_TENANT_ID = 'b2000000-0000-4000-8000-000000000002' as const;

/** Production domains for BMI University */
export const BMI_PRODUCTION_DOMAINS: readonly string[] = [
  'bmi.ac.ke',
  'www.bmi.ac.ke',
  'university.bmi.ac.ke',
  'portal.bmi.ac.ke',
  'ums.bmi.ac.ke',
  'verify.bmi.ac.ke',
  'apply.bmi.ac.ke',
  'admin.bmi.ac.ke',
  'bmiuniversities.org',
  'www.bmiuniversities.org',
  'portal.bmiuniversities.org',
  'ums.bmiuniversities.org',
  'verify.bmiuniversities.org',
  'admin.bmiuniversities.org',
  'apply.bmiuniversities.org',
  'api.bmiuniversities.org',
  'bmi-university.pages.dev',
  'bmi-portal.pages.dev',
  'bmi-ums.pages.dev',
  'portal.bmi-university.pages.dev',
  'ums.bmi-university.pages.dev',
  'main.bmi-university.pages.dev',
] as const;

/** Production domains for BEMI Institute */
export const BEMI_PRODUCTION_DOMAINS: readonly string[] = [
  'bemi.org',
  'www.bemi.org',
  'institute.bemi.org',
  'portal.bemi.org',
  'bemi.ac.ke',
  'www.bemi.ac.ke',
  'bemi-institute.pages.dev',
] as const;

/** Local development subdomains for BMI University (resolves to 127.0.0.1 in modern browsers) */
export const BMI_DEV_DOMAINS: readonly string[] = [
  'bmi.localhost',
  'bmi-university.localhost',
  'university.localhost',
  'portal.bmi.localhost',
  'ums.bmi.localhost',
] as const;

/** Local development subdomains for BEMI Institute (resolves to 127.0.0.1 in modern browsers) */
export const BEMI_DEV_DOMAINS: readonly string[] = [
  'bemi.localhost',
  'bemi-institute.localhost',
  'institute.localhost',
  'portal.bemi.localhost',
] as const;

/** Helper to extract bare hostname without port or scheme */
export function cleanHostname(host: string): string {
  const trimmed = (host || '').trim().toLowerCase();
  const withoutPort = trimmed.split(':', 1)[0] ?? trimmed;
  return withoutPort.replace(/^https?:\/\//, '').split('/', 1)[0] ?? withoutPort;
}

/** Check if host corresponds to BMI University */
export function isBmiHost(hostname: string): boolean {
  const clean = cleanHostname(hostname);
  if (!clean) return false;
  if ((BMI_PRODUCTION_DOMAINS as readonly string[]).includes(clean)) return true;
  if ((BMI_DEV_DOMAINS as readonly string[]).includes(clean)) return true;
  if (clean.endsWith('.localhost')) {
    const sub = clean.slice(0, -'.localhost'.length);
    if (sub === 'bmi' || sub.startsWith('bmi-') || sub.endsWith('-bmi')) return true;
  }
  if (clean.includes('bmiuniversities') || clean.includes('bmi-university')) return true;
  return false;
}

/** Check if host corresponds to BEMI Institute */
export function isBemiHost(hostname: string): boolean {
  const clean = cleanHostname(hostname);
  if (!clean) return false;
  if ((BEMI_PRODUCTION_DOMAINS as readonly string[]).includes(clean)) return true;
  if ((BEMI_DEV_DOMAINS as readonly string[]).includes(clean)) return true;
  if (clean.endsWith('.localhost')) {
    const sub = clean.slice(0, -'.localhost'.length);
    if (sub === 'bemi' || sub.startsWith('bemi-') || sub.endsWith('-bemi')) return true;
  }
  if (clean.includes('bemi.org') || clean.includes('bemi-institute')) return true;
  return false;
}

/** Check if host corresponds to an education tenant */
export function isEducationHost(hostname: string): boolean {
  return isBmiHost(hostname) || isBemiHost(hostname);
}

