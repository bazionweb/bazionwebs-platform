/**
 * @bmi/shared — Public API
 *
 * Re-exports all shared constants, types, and utilities.
 * Import from '@bmi/shared' in all consuming repos.
 */

// Program catalog
export type { Program, ProgramLevel } from './programs.js';
export { PROGRAMS, VALID_PROGRAMS, VALID_LEVELS } from './programs.js';

// Domain constants
export {
  PORTAL_URL,
  UMS_URL,
  UMS_PAGES_URL,
  MARKETING_URL,
  MARKETING_URL_WWW,
  PORTAL_PAGES_URL,
  UNIVERSITY_PAGES_URL,
  API_WORKER_URL,
  VERIFY_URL,
  ADMIN_URL,
  APPLY_URL,
  DEV_ORIGINS,
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
  BMI_PRODUCTION_DOMAINS,
  BEMI_PRODUCTION_DOMAINS,
  BMI_DEV_DOMAINS,
  BEMI_DEV_DOMAINS,
  cleanHostname,
  isBmiHost,
  isBemiHost,
  isEducationHost,
} from './domains.js';

// Brand design tokens
export type { BrandColorKey } from './tokens.js';
export { BrandColors } from './tokens.js';

// Institution identity (legal vs academic brand harmonization)
export {
  INSTITUTION_LEGAL_NAME,
  INSTITUTION_LEGAL_SHORT,
  INSTITUTION_ACADEMIC_BRAND,
  INSTITUTION_ACADEMIC_FULL,
  INSTITUTION_TRADING_AS_LINE,
  PAYMENT_MERCHANT_NAME,
  PAYMENT_STATEMENT_DESCRIPTOR,
  PAYMENT_SUPPORT_LINE,
  PAYSTACK_SUPPORTED_CURRENCIES,
  PAYSTACK_DEFAULT_CURRENCY,
  PAYSTACK_DEFAULT_CHANNELS,
} from './institution.js';
export type { PaystackCurrency } from './institution.js';
export { buildPaymentDescription, paymentReceiptFooter } from './institution.js';

// API contract types
export type {
  ApiSuccess,
  ApiFailure,
  ApiResponse,
  // Standard pagination — use these everywhere, not inline definitions
  PaginatedData,
  PaginatedResponse,
  RegisterRequest,
  RegisterSuccessData,
  RegisterSuccessResponse,
  AccountAlreadyExistsError,
  RegisterResponse,
  LoginRequest,
  LoginSuccessData,
  LoginSuccessResponse,
  LoginResponse,
  RefreshSuccessData,
  RefreshSuccessResponse,
  RefreshResponse,
  // Public API types
  PublicProgramResponse,
  PublicStatsResponse,
  CmsPostSummary,
  CmsPostFull,
  CmsPageContent,
  WebhookEventType,
  WebhookEvent,
} from './api-types.js';
export { API_STATUS } from './api-types.js';

// Grading logic
export { calculateGrade, percentageToGrade } from './grading.js';

// Centralized Finance, Pricing & FX
export {
  BMI_BASE_CURRENCY,
  BMI_SETTLEMENT_CURRENCY_KE,
  LEVEL_TUITION_CONFIG,
  ONBOARDING_PACKAGE,
  allocateDescendingWholeUnits,
  usdToCents,
  centsToUsd,
  convertUsdToKes,
  toGatewaySubunits,
  fromGatewaySubunits,
  formatFinancialAmount,
} from './finance.js';
export type { DegreeLevel, LevelPricingConfig } from './finance.js';

// White-label tenant configuration helpers
export {
  EDUCATION_CONFIGURATION_VERSION,
  SCHOOL_PORTAL_TEMPLATE_VERSION,
  schoolPortalConfigSchema,
  schoolEducationConfigInputSchema,
  educationInstitutionWebsiteOverridesSchema,
  bmiUniversityTenantConfig,
  bemiTrainingInstituteTenantConfig,
  createWhiteLabeledEducationConfig,
  resolveEducationInstitutionWebsiteConfig,
  createEducationInstitutionWebsiteOverlay,
} from './whitelabel.js';
export type {
  SchoolPortalConfig,
  CreateWhiteLabeledEducationInput,
  EducationInstitutionKey,
  EducationInstitutionWebsiteProfile,
} from './whitelabel.js';
