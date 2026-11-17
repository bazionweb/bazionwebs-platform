/**
 * BMI UMS — Typed HTTP API Client
 * Mirrors admin-dashboard/src/hooks/api/apiClient.ts
 *
 * - Reads the CSRF/Bearer token from sessionStorage (set on login)
 * - Throws `ApiError` (with HTTP status) so TanStack Query can react
 * - All methods are generic so callers get full type safety
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getAuthHeaders(): Record<string, string> {
  // UMS stores the CSRF token in sessionStorage after login
  const token = sessionStorage.getItem('bmi_ums_auth_token')
    || localStorage.getItem('bmi_user'); // fallback for remember-me sessions
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `HTTP ${res.status}: ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      else if (body?.message) message = body.message;
    } catch (_) { /* ignore parse errors */ }
    throw new ApiError(message, res.status);
  }
  // Handle 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Base URL — reads VITE_API_URL at build time, falls back to Vite proxy at /api */
const BASE = (typeof process !== 'undefined' ? process.env?.NEXT_PUBLIC_API_URL : undefined) ?? '';

export const apiClient = {
  get: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, { headers: getAuthHeaders(), credentials: 'include' });
    return handleResponse<T>(res);
  },

  post: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return handleResponse<T>(res);
  },

  put: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return handleResponse<T>(res);
  },

  patch: async <T>(path: string, body: unknown): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return handleResponse<T>(res);
  },

  delete: async <T>(path: string): Promise<T> => {
    const res = await fetch(`${BASE}${path}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    return handleResponse<T>(res);
  },
};
