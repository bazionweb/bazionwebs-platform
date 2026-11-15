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
