import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Portal CSRF Token Memory Storage', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Login Flow', () => {
    it('should store CSRF token in memory after successful login', async () => {
      const mockResponse = {
        success: true,
        data: {
          csrf_token: 'test-csrf-token-123',
          expires_at: '2024-12-31T23:59:59Z',
          user: {
            id: '1',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            role: 'applicant' as const,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.auth.login('test@example.com', 'password123');

      // Verify login was called
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
        })
      );

      // Verify CSRF token is returned
      expect(result.csrf_token).toBe('test-csrf-token-123');

      // Verify subsequent request includes CSRF token in header
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.auth.me();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'test-csrf-token-123',
          }),
        })
      );
    });

    it('should handle login with MFA token', async () => {
      const mockResponse = {
        success: true,
        data: {
          csrf_token: 'mfa-csrf-token-456',
          expires_at: '2024-12-31T23:59:59Z',
          user: {
            id: '2',
            email: 'mfa@example.com',
            first_name: 'MFA',
            last_name: 'User',
            role: 'admin' as const,
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      await api.auth.login('mfa@example.com', 'password123', '123456');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/login'),
        expect.objectContaining({
          body: JSON.stringify({ email: 'mfa@example.com', password: 'password123', mfa_token: '123456' }),
        })
      );
    });

    it('should handle login requiring MFA setup', async () => {
      const mockResponse = {
        success: true,
        data: {
          requires_mfa: true,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const result = await api.auth.login('mfa-required@example.com', 'password123');

      expect(result.requires_mfa).toBe(true);
      expect(result.csrf_token).toBeUndefined();
    });
  });

  describe('Logout Flow', () => {
    it('should clear CSRF token from memory after logout', async () => {
      // First login to set a token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'token-to-clear',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Now logout
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: null }),
      });

      await api.auth.logout();

      // Verify logout was called with CSRF token
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/logout'),
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'token-to-clear',
          }),
        })
      );

      // Verify subsequent request has NO CSRF token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.auth.me();

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[1].headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('CSRF Token Security', () => {
    it('should NOT persist token in localStorage', async () => {
      const localStorageSpy = vi.spyOn(Storage.prototype, 'setItem');
      const localStorageGetSpy = vi.spyOn(Storage.prototype, 'getItem');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'secure-token',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Verify localStorage was NOT used for CSRF token
      expect(localStorageSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/csrf|token/i),
        expect.any(String)
      );
      expect(localStorageGetSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/csrf|token/i)
      );

      localStorageSpy.mockRestore();
      localStorageGetSpy.mockRestore();
    });

    it('should include CSRF token in authenticated requests', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'authenticated-token',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Make an authenticated request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { application_id: 'app-123', status: 'submitted' } }),
      });

      await api.applications.submit({
        program: 'Computer Science',
        degree_level: 'Masters',
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/applications'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'authenticated-token',
          }),
        })
      );
    });

    it('should clear CSRF token on 401 unauthorized', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'expired-token',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Simulate 401 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: 'Unauthorized' }),
      });

      await expect(api.auth.me()).rejects.toThrow();

      // Next request should not have CSRF token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.auth.me();

      const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
      expect(lastCall[1].headers['X-CSRF-Token']).toBeUndefined();
    });
  });

  describe('Token Refresh', () => {
    it('should update CSRF token after refresh', async () => {
      // Initial login
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'initial-token',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Refresh token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'refreshed-token',
            expires_at: '2024-12-31T23:59:59Z',
          },
        }),
      });

      await api.auth.refresh();

      // Verify new token is used
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: {} }),
      });

      await api.auth.me();

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-CSRF-Token': 'refreshed-token',
          }),
        })
      );
    });
  });

  describe('File Upload with CSRF', () => {
    it('should include CSRF token in document upload', async () => {
      // Login first
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            csrf_token: 'upload-token',
            user: { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
          },
        }),
      });

      await api.auth.login('test@example.com', 'password123');

      // Upload document
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: 'doc-123' } }),
      });

      await api.documents.upload('app-123', 'transcript', mockFile);

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/documents/upload'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-CSRF-Token': 'upload-token',
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(api.auth.login('test@example.com', 'password123')).rejects.toThrow(
        'Network error'
      );
    });

    it('should handle timeout', async () => {
      // Mock AbortController to simulate timeout
      const mockAbort = vi.fn();
      const originalAbortController = globalThis.AbortController;
      
      globalThis.AbortController = class {
        signal = { aborted: false };
        abort = () => {
          this.signal.aborted = true;
          mockAbort();
          throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
        };
      } as any;

      mockFetch.mockImplementationOnce(() => {
        throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
      });

      await expect(api.auth.login('test@example.com', 'password123')).rejects.toThrow(
        'Request timed out'
      );

      globalThis.AbortController = originalAbortController;
    }, 10000);

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: 'Invalid credentials' }),
      });

      await expect(api.auth.login('test@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid credentials'
      );
    });
  });
});
