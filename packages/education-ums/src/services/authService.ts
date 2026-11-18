/**
 * BMI UMS - Authentication Service
 * Handles login/logout and token management using pro best practices:
 * - Short-lived Access Tokens (Authorization header)
 * - Long-lived Refresh Tokens (HTTP-only Cookies - handled by browser/backend)
 * - Automatic Token Refresh (Silent Refresh)
 */

import { ApiResponse } from '../types/index';
import { API_URL } from './config';

// API base URL is managed exclusively in ./config.ts → API_URL.

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string;
  isActive: boolean;
  lastLogin?: string;
  created?: string;
  updated?: string;
}

export interface AuthResponse {
  success: boolean;
  data?: {
    token?: string;
    user: User;
    mfaRequired?: boolean;
    mfaSetupRequired?: boolean;
    mfaToken?: string;
  };
  error?: string;
  message?: string;
}

// Token storage keys — only non-sensitive data persisted to localStorage
const USER_KEY = 'bmi_user';
const REMEMBER_KEY = 'bmi_remember_me';
const TOKEN_EXPIRY_KEY = 'bmi_token_expiry';
const JWT_KEY = 'bmi_jwt_token';
const UMS_AUTH_KEY = 'bmi_ums_auth_token';
const API_ORIGIN = API_URL.endsWith('/api/v1') ? API_URL.slice(0, -'/api/v1'.length) : API_URL;
const BETTER_AUTH_URL = `${API_ORIGIN}/api/auth`;
const EDUCATION_SESSION_URL = `${API_URL}/education/session/activate`;

function clearLegacyTokens(): void {
  try {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(JWT_KEY);
    sessionStorage.removeItem(UMS_AUTH_KEY);
    localStorage.removeItem(JWT_KEY);
  } catch {
    // Ignore browser storage access failures.
  }
}

// CSRF token stored in memory only — sent as X-CSRF-Token on state-changing requests
let _memoryToken: string | null = null;

// JWT bearer token initialized from storage — sent as Authorization: Bearer on all authenticated requests
// This handles cross-origin Pages deployments where SameSite=None cookies may be blocked
// Session timeout constants
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;  // 5 minute buffer before expiry
const WARNING_BEFORE_EXPIRY_MS = 30 * 60 * 1000; // Show warning 30 minutes before expiry

/**
 * Login with email and password
 */
export async function login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(`${BETTER_AUTH_URL}/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, rememberMe }),
      credentials: 'include',
    }, 8000);
    const signIn = await response.json().catch(() => ({})) as { message?: string; error?: string };
    if (response.status === 429) return { success: false, error: 'Too many login attempts. Please wait and try again.' };
    if (!response.ok) return { success: false, error: signIn.message || signIn.error || 'Email or password is incorrect.' };

    const sessionResponse = await fetchWithTimeout(EDUCATION_SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }, 8000);
    const sessionBody = await sessionResponse.json().catch(() => ({})) as {
      success?: boolean; error?: string; message?: string;
      data?: { user?: { id?: string; email?: string; name?: string }; organization?: { role?: string }; tenant?: { id?: string; name?: string } };
    };
    if (!sessionResponse.ok || !sessionBody.success || !sessionBody.data?.user || !sessionBody.data.organization) {
      await fetchWithTimeout(`${BETTER_AUTH_URL}/sign-out`, { method: 'POST', credentials: 'include' }, 3000).catch(() => undefined);
      return { success: false, error: sessionBody.message || sessionBody.error || 'This account is not an administrator for this institution.' };
    }

    const identity = sessionBody.data;
    const user: User = {
      id: identity.user.id ?? '', email: identity.user.email ?? email,
      name: identity.user.name ?? email, role: identity.organization.role ?? 'member', isActive: true,
    };
    _memoryToken = null;
    clearLegacyTokens();
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(REMEMBER_KEY, JSON.stringify(rememberMe));
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    return { success: true, data: { user } };
  } catch (error) {
    // Distinguish between network errors and other errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Network error: Unable to connect to the authentication server',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Check if user selected "Remember me"
 */
export function wasRememberMeSelected(): boolean {
  const remember = localStorage.getItem(REMEMBER_KEY);
  return remember ? JSON.parse(remember) : false;
}

/**
 * Logout - clear stored credentials and backend cookie
 */
export async function logout(): Promise<void> {
  try {
    await fetchWithTimeout(`${BETTER_AUTH_URL}/sign-out`, { method: 'POST', credentials: 'include' }, 3000);
  } catch {
    // Local session state is still cleared when the remote session is unavailable.
  } finally {
    // Clear memory token
    _memoryToken = null;
    clearLegacyTokens();
    // Clear localStorage
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    // Do NOT redirect here — let the App component handle navigation via state
  }
}

/**
 * Get token expiry time
 */
export function getTokenExpiry(): number | null {
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  return expiry ? parseInt(expiry, 10) : null;
}

/**
 * Check if token is about to expire (within warning period)
 */
export function isTokenExpiringSoon(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return false;
  return (expiry - Date.now()) < WARNING_BEFORE_EXPIRY_MS;
}

/**
 * Get time remaining until token expires (in seconds)
 */
export function getTokenTimeRemaining(): number {
  const expiry = getTokenExpiry();
  if (!expiry) return 0;
  const remaining = expiry - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * Check if token has expired
 */
export function isTokenExpired(): boolean {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  return Date.now() >= (expiry - TOKEN_EXPIRY_BUFFER_MS);
}

/**
 * Get current access token (from memory only)
 */
export function getToken(): string | null {
  return _memoryToken;
}

/**
 * Get current user
 */
export function getCurrentUser(): User | null {
  const userJson = localStorage.getItem(USER_KEY);
  if (!userJson) return null;
  try {
    return JSON.parse(userJson) as User;
  } catch {
    return null;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!_memoryToken || !!localStorage.getItem(USER_KEY);
}

/** Compatibility entrypoint: Better Auth refreshes its session cookie server-side. */
export async function refreshAccessToken(): Promise<string | null> {
  if (!(await verifySession())) return null;
  return null;
}

/**
 * Fetch with authentication and automatic retry on 401 (Token Refresh)
 */
export async function authFetch(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const isFormData = options.body instanceof FormData;
  const headers = new Headers(options.headers);
  if (options.body && !isFormData && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  headers.delete('Authorization');
  headers.delete('X-CSRF-Token');
  // Use AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server not responding', { cause: error });
    }
    throw error;
  }
}

/**
 * Fetch with timeout wrapper to prevent hanging requests
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server not responding', { cause: error });
    }
    throw error;
  }
}

/**
 * Verify session on app startup
 */
export async function verifySession(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(EDUCATION_SESSION_URL, { method: 'POST' }, 10000);
    const result = await response.json().catch(() => ({})) as {
      success?: boolean;
      data?: { user?: { id?: string; email?: string; name?: string }; organization?: { role?: string } };
    };
    const identity = result.data;
    if (!response.ok || !result.success || !identity?.user || !identity.organization) {
      clearLocalAuthState();
      return false;
    }
    _memoryToken = null;
    clearLegacyTokens();
    const user: User = {
      id: identity.user.id ?? '', email: identity.user.email ?? '', name: identity.user.name ?? '',
      role: identity.organization.role ?? 'member', isActive: true,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    return true;
  } catch {
    return false;
  }
}

function clearLocalAuthState(): void {
  _memoryToken = null;
  clearLegacyTokens();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(REMEMBER_KEY);
}

/**
 * Quick health check for backend availability.
 * Strips the `/api/v1` suffix from API_URL so we can hit the `/health`
 * endpoint on the API origin (not under the versioned prefix).
 */
export async function isBackendAvailable(): Promise<boolean> {
  try {
    const healthUrl = API_URL.endsWith('/api/v1')
      ? `${API_URL.slice(0, -'/api/v1'.length)}/health`
      : `${API_URL}/health`;
    const response = await fetchWithTimeout(
      healthUrl,
      { method: 'GET' },
      2000
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Verify MFA code
 */
export async function verifyMfa(mfaToken: string, code: string): Promise<AuthResponse> {
  void mfaToken;
  void code;
  return { success: false, error: 'Two-factor authentication is not enabled for this UMS sign-in flow.' };
}

/**
 * Setup MFA (Generate secret and QR code)
 * Can be called with either access token or mfa token
 */
export async function setupMfa(token: string): Promise<ApiResponse<{ secret: string; qrCode: string }>> {
  void token;
  return { success: false, error: { code: 'MFA_UNAVAILABLE', message: 'Two-factor authentication is not enabled for this UMS sign-in flow.' } };
}

/**
 * Enable MFA (Verify first code and get recovery codes)
 */
export async function enableMfa(token: string, secret: string, code: string): Promise<ApiResponse<{ recoveryCodes: string[] }>> {
  void token;
  void secret;
  void code;
  return { success: false, error: { code: 'MFA_UNAVAILABLE', message: 'Two-factor authentication is not enabled for this UMS sign-in flow.' } };
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  try {
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
    const response = await fetchWithTimeout(`${BETTER_AUTH_URL}/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, ...(redirectTo ? { redirectTo } : {}) }),
    }, 8000);
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    return { success: response.ok, ...(!response.ok ? { error: data.message || data.error || 'Password reset request failed.' } : {}) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Complete password reset with token
 */
export async function resetPassword(
  token: string,
  password: string,
//   passwordConfirm: string
): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(`${BETTER_AUTH_URL}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword: password }),
    }, 8000);
    const data = await response.json().catch(() => ({})) as { message?: string; error?: string };
    return { success: response.ok, ...(!response.ok ? { error: data.message || data.error || 'Password reset failed.' } : {}) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
