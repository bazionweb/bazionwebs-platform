/**
 * BMI UMS - Auth Store Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../stores/authStore';

// Mock the authService module
vi.mock('../services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  verifySession: vi.fn(),
  refreshAccessToken: vi.fn(),
  getToken: vi.fn(),
  getCurrentUser: vi.fn(),
  isTokenExpired: vi.fn(),
}));

import { login, verifySession, getToken, getCurrentUser } from '../services/authService';

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isLoggedIn: false,
      isAuthenticating: false,
      user: null,
      token: null,
    });
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.isAuthenticating).toBe(false); // reset in beforeEach
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe('checkSession', () => {
    it('should set isLoggedIn to true when session is valid', async () => {
      (verifySession as any).mockResolvedValue(true);
      (getCurrentUser as any).mockReturnValue({ id: '1', name: 'Admin', role: 'admin' });
      (getToken as any).mockReturnValue('test-token');

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.isAuthenticating).toBe(false);
    });

    it('should set isLoggedIn to false when session is invalid', async () => {
      (verifySession as any).mockResolvedValue(false);

      await useAuthStore.getState().checkSession();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.isAuthenticating).toBe(false);
    });
  });

  describe('login', () => {
    it('should update state on successful login', async () => {
      const mockUser = { id: '1', name: 'Admin', role: 'admin', email: 'admin@bmi.edu', isActive: true };
      (login as any).mockResolvedValue({
        success: true,
        data: { token: 'test-token', user: mockUser },
      });

      const result = await useAuthStore.getState().login('admin@bmi.edu', 'password123');

      expect(result.success).toBe(true);
      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(true);
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
    });

    it('should not update state on failed login', async () => {
      (login as any).mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const result = await useAuthStore.getState().login('admin@bmi.edu', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
      expect(useAuthStore.getState().isLoggedIn).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear all auth state', async () => {
      useAuthStore.setState({
        isLoggedIn: true,
        user: { id: '1', name: 'Admin', role: 'admin', email: 'a@b.com', isActive: true },
        token: 'test-token',
      });

      await useAuthStore.getState().logout();

      const state = useAuthStore.getState();
      expect(state.isLoggedIn).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });
});










