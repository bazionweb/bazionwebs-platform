/**
 * @bmi/shared — API Contract Types
 *
 * TypeScript types for the API surface consumed by bmi-university.
 * The portal worker is the source of truth; these types are published here
 * so both sides can be kept in sync via the shared package version.
 *
 * Endpoints covered:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *
 * Contract test: bmi-portal/worker/lib/jwt.contract.test.ts
 * Snapshot test: bmi-portal/worker/lib/openapi.snapshot.test.ts
 */

// ── Generic API Response Shell ─────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: string;
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiFailure;

// ── Standard Pagination ────────────────────────────────────────────────────
//
// Every paginated list endpoint in the BMI API must return:
//   { success: true, data: PaginatedData<T> }
//
// where PaginatedData<T> is:
//   { items: T[], page: number, perPage: number, total: number }
//
// Frontend services type their list responses as:
//   ApiSuccess<PaginatedData<T>>  — i.e. PaginatedResponse<T>
//
// This is the single source of truth — do not redefine inline in services or routes.

/**
 * The data payload inside a paginated list response.
 * Wrap with ApiSuccess<PaginatedData<T>> for the full response type.
 */
export interface PaginatedData<T> {
  /** The current page's records. */
  items: T[];
  /** Current page number (1-indexed). */
  page: number;
  /** Maximum items per page. */
  perPage: number;
  /** Total number of records matching the query (across all pages). */
  total: number;
}

/**
 * A successful paginated list API response.
 * Equivalent to: { success: true, data: { items: T[], page, perPage, total } }
 */
export type PaginatedResponse<T> = ApiSuccess<PaginatedData<T>>;


// ── POST /api/auth/register ────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export interface RegisterSuccessData {
  user_id: string;
  message: string;
}

/** HTTP 201 — Account created successfully. */
export type RegisterSuccessResponse = ApiSuccess<RegisterSuccessData>;

/**
 * HTTP 409 — An account with this email already exists.
 * The university apply page (and any other API consumer) must handle this case.
 */
export interface AccountAlreadyExistsError extends ApiFailure {
  error: 'An account with this email already exists';
}

export type RegisterResponse = RegisterSuccessResponse | ApiFailure;

// ── POST /api/auth/login ───────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginSuccessData {
  token: string;
  expires_at: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'applicant' | 'student' | 'staff' | 'admin';
    is_verified: number;
  };
}

/** HTTP 200 — Login successful. */
export type LoginSuccessResponse = ApiSuccess<LoginSuccessData>;

export type LoginResponse = LoginSuccessResponse | ApiFailure;

// ── POST /api/auth/refresh ─────────────────────────────────────────────────

export interface RefreshSuccessData {
  token: string;
  expires_at: string;
}

/** HTTP 200 — Session refreshed successfully. */
export type RefreshSuccessResponse = ApiSuccess<RefreshSuccessData>;

export type RefreshResponse = RefreshSuccessResponse | ApiFailure;

// ── HTTP Status Code Constants ─────────────────────────────────────────────

export const API_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
} as const;

// ── GET /api/public/programs ────────────────────────────────────────────

export interface PublicProgramResponse {
  id: string;
  code: string;
  label: string;
  level: 'undergraduate' | 'graduate' | 'doctorate' | 'certificate';
  description: string;
  credits: number;
  term: string;
  available_seats: number | null;
}

// ── GET /api/public/stats ────────────────────────────────────────────────

export interface PublicStatsResponse {
  total_programs: number;
  total_enrolled_students: number;
  total_applications_this_term: number;
}

// ── GET /api/public/cms/posts ──────────────────────────────────────────

export interface CmsPostSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  tags: string[] | null;
  published_at: string;
}

export interface CmsPostFull extends CmsPostSummary {
  content: string | null;
  author: { first_name: string; last_name: string };
}

// ── GET /api/public/cms/pages/:slug ───────────────────────────────────

export interface CmsPageContent {
  id: string;
  title: string;
  slug: string;
  content: string | null;
  published_at: string;
}

// ── Webhook Event Payload ─────────────────────────────────────────────

export type WebhookEventType =
  | 'application.submitted'
  | 'application.status_changed'
  | 'user.registered'
  | 'user.accepted';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  created_at: string;
  data: Record<string, unknown>;
}
