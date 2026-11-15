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

function getStoredJwt(): string | null {
  try {
    return (typeof window !== 'undefined')
      ? (sessionStorage.getItem(JWT_KEY)
        || sessionStorage.getItem(UMS_AUTH_KEY)
        || localStorage.getItem(JWT_KEY)
        || null)
      : null;
  } catch {
    return null;
  }
}

function setStoredJwt(token: string | null, rememberMe: boolean = false): void {
  _jwtToken = token;
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      sessionStorage.setItem(JWT_KEY, token);
      sessionStorage.setItem(UMS_AUTH_KEY, token);
      if (rememberMe) {
        localStorage.setItem(JWT_KEY, token);
      }
    } else {
      sessionStorage.removeItem(JWT_KEY);
      sessionStorage.removeItem(UMS_AUTH_KEY);
      localStorage.removeItem(JWT_KEY);
    }
  } catch {
    // Ignore storage quota / security exceptions
  }
}

// CSRF token stored in memory only — sent as X-CSRF-Token on state-changing requests
let _memoryToken: string | null = null;

// JWT bearer token initialized from storage — sent as Authorization: Bearer on all authenticated requests
// This handles cross-origin Pages deployments where SameSite=None cookies may be blocked
let _jwtToken: string | null = getStoredJwt();

// Session timeout constants
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;  // 5 minute buffer before expiry
const WARNING_BEFORE_EXPIRY_MS = 30 * 60 * 1000; // Show warning 30 minutes before expiry

/**
 * Login with email and password
 */
export async function login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, rememberMe }),
      credentials: 'include',
    }, 8000);

    // Handle rate limiting (429) — returns plain text, not JSON
    if (response.status === 429) {
      return {
        success: false,
        error: 'Too many login attempts. Please wait 15 minutes and try again.',
      };
    }

    // Guard against empty responses
    const text = await response.text();
    if (!text || text.trim() === '') {
      return {
        success: false,
        error: 'Server returned an empty response. Please try again.',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: 'Invalid server response. Please try again.',
      };
    }

    if (data.success) {
      if (data.requires_mfa || data.data?.requires_mfa) {
        return {
          success: true,
          data: {
            mfaRequired: true,
            user: data.data?.user || data.user,
          }
        };
      }
      // Regular login success - store user info
      // API returns: { success: true, data: { csrf_token, user } }
      const apiUser = data.data?.user || data.user;
      if (!apiUser) {
        return {
          success: false,
          error: 'Invalid server response: user data missing',
        };
      }
      const user = {
        id: apiUser.id,
        email: apiUser.email,
        name: `${apiUser.first_name} ${apiUser.last_name}`,
        role: apiUser.role,
        isActive: true,
      };

      // Guard: UMS is exclusively for University Staff, Faculty, and Administrators
      if (user.role === 'student' || user.role === 'applicant') {
        return {
          success: false,
          error: 'Access Restricted: The University Management System (UMS) is strictly for university staff, faculty, and administrators. Please log in to the Student Portal at https://portal.bmiuniversities.org',
        };
      }

      // eslint-disable-next-line no-console
      console.log('[authService] Login success - User object:', user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(REMEMBER_KEY, JSON.stringify(rememberMe));
      const expiryTime = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days (matches backend cookie)
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
      _memoryToken = data.data?.csrf_token || data.csrf_token; // Store CSRF token in memory
      const jwt = data.data?.token || data.token || null;
      setStoredJwt(jwt, rememberMe);

      // eslint-disable-next-line no-console
      console.log('[authService] Returning success with user role:', user.role);
      return {
        success: true,
        data: {
          token: data.data?.csrf_token || data.csrf_token,
          user,
        }
      };
    } else {
      return {
        success: false,
        error: data.error || 'Login failed',
      };
    }
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
    await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/logout`, { method: 'DELETE' }, 3000);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Logout request failed:', error);
  } finally {
    // Clear memory token
    _memoryToken = null;
    setStoredJwt(null);
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

/**
 * Refresh the access token by re-validating the existing HttpOnly cookie.
 * The BMI API uses cookie-based auth, so we simply re-hit /auth/me to get
 * a fresh CSRF token.  If the cookie has expired, the request will 401 and
 * we return null so the caller can redirect to login.
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const existingJwt = getStoredJwt();
    const headers: Record<string, string> = {};
    if (existingJwt) {
      headers['Authorization'] = `Bearer ${existingJwt}`;
    }
    const response = await fetchWithTimeout(
      `${API_URL.replace('/v1', '')}/auth/me`,
      { method: 'GET', headers },
      5000,
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.success) {
      if (data.data?.csrf_token || data.csrf_token) {
        _memoryToken = data.data?.csrf_token || data.csrf_token;
      }
      const refreshedJwt = data.data?.token || data.token;
      if (refreshedJwt) {
        setStoredJwt(refreshedJwt, wasRememberMeSelected());
        return refreshedJwt;
      }
      return _memoryToken;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch with authentication and automatic retry on 401 (Token Refresh)
 */
export async function authFetch(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const csrfToken = _memoryToken;
  const isFormData = options.body instanceof FormData;
  const activeJwt = _jwtToken || getStoredJwt();

  const headers: Record<string, string> = {
    // Don't force JSON when the caller is sending multipart FormData (authFetch must not
    // mangle the browser-generated multipart boundary).
    ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
    // Send JWT as Authorization header so cross-origin Pages requests authenticate
    // even when the SameSite=None cookie doesn't flow correctly
    ...(activeJwt ? { 'Authorization': `Bearer ${activeJwt}` } : {}),
    ...(options.headers as Record<string, string>),
  };

  // Use AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    // If unauthorized, try to refresh token once
    if (response.status === 401) {
      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Retry with new token
        return fetch(url, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      }
    }

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
  const storedUser = localStorage.getItem(USER_KEY);
  if (!storedUser) {
    return false;
  }

  try {
    // Use a forgiving timeout for the initial session check so a cold-
    // starting worker (first request after deploy) doesn't bounce the user out.
    const response = await authFetch(`${API_URL.replace('/v1', '')}/auth/me`, {}, 10000);
    const data = await response.json();

    if (data.success && data.data) {
      const apiUser = data.data;
      const user = {
        id: apiUser.id,
        email: apiUser.email,
        name: `${apiUser.first_name} ${apiUser.last_name}`,
        role: apiUser.role,
        isActive: true,
      };

      // Guard: UMS is exclusively for University Staff, Faculty, and Administrators
      if (user.role === 'student' || user.role === 'applicant') {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_EXPIRY_KEY);
        localStorage.removeItem(REMEMBER_KEY);
        _memoryToken = null;
        _jwtToken = null;
        return false;
      }

      // eslint-disable-next-line no-console
      console.log('[authService] Session verified - User object:', user);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      if (data.csrf_token || data.data?.csrf_token) {
        _memoryToken = data.data?.csrf_token || data.csrf_token;
      }
      const refreshedJwt = data.token || data.data?.token;
      if (refreshedJwt) {
        setStoredJwt(refreshedJwt, wasRememberMeSelected());
      } else if (!_jwtToken) {
        _jwtToken = getStoredJwt();
      }
      return true;
    }
    return false;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('Session verification failed:', error);
    return false;
  }
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
  try {
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/mfa/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mfaToken, code }),
    }, 8000);

    const data: AuthResponse = await response.json();

    if (data.success && data.data?.token) {
      _memoryToken = data.data.token;
      localStorage.setItem(USER_KEY, JSON.stringify(data.data.user));
      const expiryTime = Date.now() + (8 * 60 * 60 * 1000);
      localStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());
    }

    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Setup MFA (Generate secret and QR code)
 * Can be called with either access token or mfa token
 */
export async function setupMfa(token: string): Promise<ApiResponse<{ secret: string; qrCode: string }>> {
  try {
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/mfa/setup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
    }, 8000);

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Enable MFA (Verify first code and get recovery codes)
 */
export async function enableMfa(token: string, secret: string, code: string): Promise<ApiResponse<{ recoveryCodes: string[] }>> {
  try {
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/mfa/enable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ secret, code }),
    }, 8000);

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

/**
 * Request password reset email
 */
export async function requestPasswordReset(email: string): Promise<AuthResponse> {
  try {
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    }, 8000);

    const data: AuthResponse = await response.json();
    return data;
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
    const response = await fetchWithTimeout(`${API_URL.replace('/v1', '')}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, new_password: password }),
    }, 8000);

    const data: AuthResponse = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
