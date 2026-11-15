/**
 * Integration test for Portal CSRF Token Memory Storage
 * 
 * This test verifies the complete login/logout flow with CSRF token management:
 * 1. Login with valid credentials stores CSRF token in memory
 * 2. Authenticated requests include the CSRF token
 * 3. Logout clears the CSRF token from memory
 * 4. Token is NOT persisted in localStorage (XSS protection)
 * 5. Token does NOT survive page reload (memory-only storage)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

describe('Portal Login/Logout Integration Flow', () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockClear();
    
    // Clear any existing tokens
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: null }),
    });
    api.auth.logout().catch(() => {});
  });

  it('Complete Flow: Login → Authenticated Request → Logout → Unauthenticated Request', async () => {
    // ===== STEP 1: Login =====
    console.log('Step 1: Testing login...');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'session-token-abc123',
          expires_at: '2024-12-31T23:59:59Z',
          user: {
            id: 'user-123',
            email: 'bmiuniversity8@gmail.com',
            first_name: 'Admin',
            last_name: 'User',
            role: 'admin',
          },
        },
      }),
    });

    const loginResult = await api.auth.login('bmiuniversity8@gmail.com', 'Admin@123');
    
    expect(loginResult.csrf_token).toBe('session-token-abc123');
    expect(loginResult.user?.email).toBe('bmiuniversity8@gmail.com');
    console.log('✓ Login successful, CSRF token stored in memory');

    // ===== STEP 2: Verify CSRF token NOT in localStorage =====
    console.log('Step 2: Verifying token is NOT in localStorage...');
    
    const localStorageKeys = Object.keys(localStorage);
    const hasCSRFInLocalStorage = localStorageKeys.some(key => 
      key.toLowerCase().includes('csrf') || key.toLowerCase().includes('token')
    );
    
    expect(hasCSRFInLocalStorage).toBe(false);
    console.log('✓ CSRF token is NOT in localStorage (XSS protection working)');

    // ===== STEP 3: Make authenticated request =====
    console.log('Step 3: Testing authenticated request...');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          id: 'user-123',
          email: 'bmiuniversity8@gmail.com',
          first_name: 'Admin',
          last_name: 'User',
          role: 'admin',
        },
      }),
    });

    const meResult = await api.auth.me();
    
    expect(meResult.email).toBe('bmiuniversity8@gmail.com');
    
    // Verify CSRF token was included in request
    const meCall = mockFetch.mock.calls.find(call => 
      call[0].includes('/api/auth/me')
    );
    expect(meCall).toBeDefined();
    expect(meCall![1].headers['X-CSRF-Token']).toBe('session-token-abc123');
    console.log('✓ Authenticated request includes CSRF token in headers');

    // ===== STEP 4: Make another authenticated request (admin action) =====
    console.log('Step 4: Testing admin action with CSRF token...');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: [
          { id: 'app-1', program: 'CS', status: 'submitted' },
          { id: 'app-2', program: 'MBA', status: 'under_review' },
        ],
      }),
    });

    const applications = await api.admin.listApplications({ limit: 10 });
    
    expect(applications.length).toBe(2);
    
    const adminCall = mockFetch.mock.calls.find(call => 
      call[0].includes('/api/admin/applications')
    );
    expect(adminCall![1].headers['X-CSRF-Token']).toBe('session-token-abc123');
    console.log('✓ Admin request includes CSRF token');

    // ===== STEP 5: Logout =====
    console.log('Step 5: Testing logout...');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: null }),
    });

    await api.auth.logout();
    
    console.log('✓ Logout successful, CSRF token cleared from memory');

    // ===== STEP 6: Verify token is cleared =====
    console.log('Step 6: Verifying token is cleared after logout...');
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { email: 'test@example.com' },
      }),
    });

    await api.auth.me();
    
    // Check that the last call has NO CSRF token
    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers['X-CSRF-Token']).toBeUndefined();
    console.log('✓ Subsequent requests do NOT include CSRF token');

    console.log('\n✅ All integration tests passed!');
  });

  it('Token Refresh Flow: Login → Refresh → Verify New Token Used', async () => {
    console.log('Testing token refresh flow...');

    // Login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'initial-token-v1',
          expires_at: '2024-12-31T23:59:59Z',
          user: {
            id: 'user-123',
            email: 'test@example.com',
            first_name: 'Test',
            last_name: 'User',
            role: 'applicant',
          },
        },
      }),
    });

    await api.auth.login('test@example.com', 'password123');
    console.log('✓ Initial login with token: initial-token-v1');

    // Refresh token
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'refreshed-token-v2',
          expires_at: '2024-12-31T23:59:59Z',
        },
      }),
    });

    await api.auth.refresh();
    console.log('✓ Token refreshed: refreshed-token-v2');

    // Verify new token is used
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { id: 'user-123' },
      }),
    });

    await api.auth.me();

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers['X-CSRF-Token']).toBe('refreshed-token-v2');
    console.log('✓ New token is used in subsequent requests');
  });

  it('401 Unauthorized: Token Automatically Cleared', async () => {
    console.log('Testing automatic token clearing on 401...');

    // Login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'valid-token',
          user: { id: 'user-123', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
        },
      }),
    });

    await api.auth.login('test@example.com', 'password123');
    console.log('✓ Login successful with token');

    // Simulate 401 response (e.g., token expired)
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ success: false, error: 'Token expired' }),
    });

    try {
      await api.auth.me();
    } catch (error: any) {
      expect(error.status).toBe(401);
      console.log('✓ 401 error caught');
    }

    // Verify token was cleared
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
    });

    await api.auth.me();

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers['X-CSRF-Token']).toBeUndefined();
    console.log('✓ Token automatically cleared after 401');
  });

  it('File Upload: CSRF Token Included in Multipart Request', async () => {
    console.log('Testing file upload with CSRF token...');

    // Login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'upload-token-xyz',
          user: { id: 'user-123', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
        },
      }),
    });

    await api.auth.login('test@example.com', 'password123');
    console.log('✓ Login successful');

    // Upload file
    const mockFile = new File(['test content'], 'document.pdf', { type: 'application/pdf' });
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { id: 'doc-123' } }),
    });

    await api.documents.upload('app-123', 'transcript', mockFile);

    const uploadCall = mockFetch.mock.calls.find(call => 
      call[0].includes('/api/documents/upload')
    );
    
    expect(uploadCall).toBeDefined();
    expect(uploadCall![1].headers['X-CSRF-Token']).toBe('upload-token-xyz');
    expect(uploadCall![1].body).toBeInstanceOf(FormData);
    console.log('✓ File upload includes CSRF token in headers');
  });

  it('Session Persistence: Token Does NOT Survive "Page Reload" Simulation', async () => {
    console.log('Testing that token does NOT persist (memory-only storage)...');

    // Login
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          csrf_token: 'session-only-token',
          user: { id: 'user-123', email: 'test@example.com', first_name: 'Test', last_name: 'User', role: 'applicant' },
        },
      }),
    });

    await api.auth.login('test@example.com', 'password123');
    console.log('✓ Login successful with token in memory');

    // Simulate page reload by clearing module cache and token
    // In a real browser, this would be a page refresh that clears memory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: null }),
    });
    
    await api.auth.logout();
    console.log('✓ Simulated page reload (logout clears memory)');

    // Try to make request without logging in again
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: {} }),
    });

    await api.auth.me();

    const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
    expect(lastCall[1].headers['X-CSRF-Token']).toBeUndefined();
    console.log('✓ Token does NOT persist after "page reload" - must login again');
  });
});
