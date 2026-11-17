import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './useAuth';
import { api } from '../lib/api';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor } from '@testing-library/react';


vi.mock('../lib/api', () => ({
  api: {
    auth: {
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      me: vi.fn(),
    },
    user: {
      // me moved to auth
    },
  },
}));

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (api.auth.me as any).mockRejectedValue(new Error('unauthenticated'));
  });

  it('provides unauthenticated state initially if no token', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it('handles successful login', async () => {
    const mockUser = { id: '1', email: 'test@test.com', first_name: 'Test', last_name: 'User', role: 'applicant' as const, is_verified: 1 };
    (api.auth.login as any).mockResolvedValue({
      token: 'fake-jwt',
      user: mockUser,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await act(async () => {
      await result.current.login('test@test.com', 'password');
    });

    await waitFor(() => {
      expect(api.auth.login).toHaveBeenCalledWith('test@test.com', 'password');
    });
    expect(result.current.user).toEqual(mockUser);
  });

  it('handles logout', async () => {
    localStorage.setItem('bmi_token', 'fake-jwt');
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    
    // Simulate being logged in
    act(() => {
      // Force internal state if possible, or just call logout
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(api.auth.logout).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });
});
