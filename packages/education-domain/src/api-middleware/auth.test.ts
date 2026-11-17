import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from './auth';
import { signJWT } from './jwt';

const SECRET = 'test-secret-key-for-auth-unit-tests';

function makeDb(row: unknown) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as any;
}

function authedRequest(token: string) {
  return new Request('http://localhost/api/student/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('requireAuth role sync', () => {
  it('gates on the live DB role when the JWT claim is stale (applicant token, student row)', async () => {
    const token = await signJWT({ sub: 'u-1', role: 'applicant', sv: 1 }, SECRET);
    const db = makeDb({ session_version: 1, role: 'student' });
    const res = await requireAuth(authedRequest(token), db, SECRET, ['student']);
    expect(res).not.toBeInstanceOf(Response);
    expect((res as any).user.sub).toBe('u-1');
  });

  it('denies when the live DB role lacks permission even if the JWT claims otherwise', async () => {
    const token = await signJWT({ sub: 'u-1', role: 'admin', sv: 1 }, SECRET);
    const db = makeDb({ session_version: 1, role: 'applicant' });
    const res = await requireAuth(authedRequest(token), db, SECRET, ['student']);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it('falls back to the JWT claim when the DB row carries no role (legacy/mocked DBs)', async () => {
    const token = await signJWT({ sub: 'u-1', role: 'student', sv: 1 }, SECRET);
    const db = makeDb({ session_version: 1 });
    const res = await requireAuth(authedRequest(token), db, SECRET, ['student']);
    expect(res).not.toBeInstanceOf(Response);
  });

  it('still rejects on session_version mismatch', async () => {
    const token = await signJWT({ sub: 'u-1', role: 'student', sv: 1 }, SECRET);
    const db = makeDb({ session_version: 2, role: 'student' });
    const res = await requireAuth(authedRequest(token), db, SECRET, ['student']);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });

  it('still returns 401 when the user row is missing', async () => {
    const token = await signJWT({ sub: 'u-1', role: 'student', sv: 1 }, SECRET);
    const db = makeDb(null);
    const res = await requireAuth(authedRequest(token), db, SECRET, ['student']);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(401);
  });
});
