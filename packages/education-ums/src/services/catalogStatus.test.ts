import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCourses } from './courseService';
import { getPrograms } from './programService';
import { authFetch } from './authService';

vi.mock('./authService', () => ({
  authFetch: vi.fn(),
}));

const mockedAuthFetch = authFetch as unknown as ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('catalog services propagate HTTP status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCourses attaches status on success', async () => {
    mockedAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { items: [], page: 1, perPage: 50, total: 0 } }, 200),
    );
    const res = await getCourses({ perPage: 50 });
    expect(res.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it('getCourses attaches 401 status on auth failure', async () => {
    mockedAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid or expired token' }, 401),
    );
    const res = await getCourses({ perPage: 50 });
    expect(res.success).toBe(false);
    expect(res.status).toBe(401);
  });

  it('getCourses reports status 0 on network failure', async () => {
    mockedAuthFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const res = await getCourses({ perPage: 50 });
    expect(res.success).toBe(false);
    expect(res.status).toBe(0);
  });

  it('getPrograms attaches status on success and failure', async () => {
    mockedAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: true, data: { items: [], page: 1, perPage: 20, total: 0 } }, 200),
    );
    const ok = await getPrograms();
    expect(ok.success).toBe(true);
    expect(ok.status).toBe(200);

    mockedAuthFetch.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Session has been invalidated' }, 401),
    );
    const denied = await getPrograms();
    expect(denied.success).toBe(false);
    expect(denied.status).toBe(401);
  });

  it('getPrograms reports status 0 on network failure', async () => {
    mockedAuthFetch.mockRejectedValueOnce(new Error('Request timeout - server not responding'));
    const res = await getPrograms();
    expect(res.success).toBe(false);
    expect(res.status).toBe(0);
  });
});
