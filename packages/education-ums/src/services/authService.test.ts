import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  login,
  logout,
  getToken,
  getCurrentUser,
  isAuthenticated,
  isTokenExpired,
  getTokenTimeRemaining,
  isTokenExpiringSoon,
  wasRememberMeSelected,
  requestPasswordReset,
  resetPassword,
} from './authService';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock fetch
global.fetch = vi.fn();

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the in-memory token by importing a fresh module state
    // The _memoryToken variable is module-scoped, so we need to use logout to clear it
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('should store token in memory and user in localStorage on successful login', async () => {
      const mockUser = { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'admin' };
      const mockResponse = {
        success: true,
        csrf_token: 'test-token',
        user: mockUser,
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await login('test@example.com', 'password123');

      expect(result.success).toBe(true);
      // Token is now stored in memory (not localStorage) for XSS protection
      expect(getToken()).toBe('test-token');
      // User info (non-sensitive) is stored in localStorage
      const expectedStoredUser = { id: '1', email: 'test@example.com', name: 'Test User', role: 'admin', isActive: true };
      expect(localStorage.setItem).toHaveBeenCalledWith('bmi_user', JSON.stringify(expectedStoredUser));
    });

    it('should return error on failed login', async () => {
      const mockResponse = {
        success: false,
        error: 'Invalid credentials',
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 401,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      const result = await login('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await login('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should pass rememberMe to backend', async () => {
      const mockUser = { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'admin' };
      const mockResponse = {
        success: true,
        csrf_token: 'test-token',
        user: mockUser,
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await login('test@example.com', 'password123', true);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
            rememberMe: true,
          }),
        })
      );
      expect(localStorage.setItem).toHaveBeenCalledWith('bmi_remember_me', 'true');
    });
  });

  describe('logout', () => {
    it('should clear memory token and localStorage user data', async () => {
      // First login to set state
      const mockUser = { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'admin' };
      const mockResponse = {
        success: true,
        csrf_token: 'test-token', 
        user: mockUser,
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await login('test@example.com', 'password123');
      expect(getToken()).toBe('test-token');

      // Now logout
      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      await logout();

      expect(getToken()).toBeNull();
      expect(localStorage.removeItem).toHaveBeenCalledWith('bmi_user');
      expect(localStorage.removeItem).toHaveBeenCalledWith('bmi_token_expiry');
    });
  });

  describe('getToken', () => {
    it('should return null when no token in memory', () => {
      // After a fresh import or logout, token should be null
      expect(getToken()).toBeNull();
    });

    it('should return token from memory after login', async () => {
      const mockUser = { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'admin' };
      const mockResponse = {
        success: true,
        csrf_token: 'memory-token', 
        user: mockUser,
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await login('test@example.com', 'password123');
      expect(getToken()).toBe('memory-token');
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token in memory', async () => {
      // Clear any lingering in-memory token from previous tests
      (global.fetch as any).mockResolvedValueOnce({ ok: true });
      await logout();

      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when token exists in memory', async () => {
      const mockUser = { id: '1', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'admin' };
      const mockResponse = {
        success: true,
        csrf_token: 'auth-token', 
        user: mockUser,
      };

      (global.fetch as any).mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: async () => JSON.stringify(mockResponse),
      });

      await login('test@example.com', 'password123');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('getCurrentUser', () => {
    it('should return parsed user from localStorage', () => {
      const user = { id: '1', email: 'test@example.com', name: 'Test', role: 'admin', isActive: true };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(user));

      const result = getCurrentUser();

      expect(result).toEqual(user);
    });

    it('should return null when no user', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(getCurrentUser()).toBeNull();
    });

    it('should return null on invalid JSON', () => {
      localStorageMock.getItem.mockReturnValue('invalid-json');

      expect(getCurrentUser()).toBeNull();
    });
  });

  describe('token expiry', () => {
    it('isTokenExpired should return true when no expiry', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(isTokenExpired()).toBe(true);
    });

    it('isTokenExpired should return true when past expiry', () => {
      const pastTime = Date.now() - 1000;
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'bmi_token_expiry') return pastTime.toString();
        return null;
      });

      expect(isTokenExpired()).toBe(true);
    });

    it('getTokenTimeRemaining should return 0 when no expiry', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(getTokenTimeRemaining()).toBe(0);
    });

    it('isTokenExpiringSoon should return false when no expiry', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(isTokenExpiringSoon()).toBe(false);
    });
  });

  describe('wasRememberMeSelected', () => {
    it('should return remember me preference', () => {
      localStorageMock.getItem.mockReturnValue('true');

      expect(wasRememberMeSelected()).toBe(true);
    });

    it('should return false when no preference stored', () => {
      localStorageMock.getItem.mockReturnValue(null);

      expect(wasRememberMeSelected()).toBe(false);
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset request', async () => {
      const mockResponse = {
        success: true,
        message: 'Reset email sent',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const result = await requestPasswordReset('user@example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/forgot-password'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 'user@example.com' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should complete password reset', async () => {
      const mockResponse = {
        success: true,
        message: 'Password reset successful',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockResponse),
        json: async () => mockResponse,
      });

      const result = await resetPassword('token123', 'newpassword');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/reset-password'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'token123', new_password: 'newpassword' }),
        })
      );
      expect(result.success).toBe(true);
    });
  });
});
