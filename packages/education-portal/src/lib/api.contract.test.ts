/**
 * Portal ↔ API path contract — asserts the portal client calls the canonical
 * backend routes with the canonical payloads. Any drift fails here first.
 * Mirror of apps/api/routes/api-contract.test.ts (backend side).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

function stubFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: {} }),
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

describe('portal api path contract', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('submit sends program_id (canonical) with program fallback', async () => {
    const calls = stubFetch();
    await api.applications.submit({ program_id: 'prog-1', program: 'Theology', degree_level: 'undergraduate' } as any);
    const call = calls[0];
    expect(call.url).toMatch(/\/api\/applications$/);
    expect(call.init.method).toBe('POST');
    const body = JSON.parse(call.init.body as string);
    expect(body.program_id).toBe('prog-1');
    expect(body.program).toBe('Theology');
  });

  it('reserveSeat sends section_id (never bare courseId)', async () => {
    const calls = stubFetch();
    await api.registration.reserveSeat('sec-1', 'term-1');
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/api\/registration\/reserve-seat$/);
    expect(body.section_id).toBe('sec-1');
    expect(body.term_id).toBe('term-1');
  });

  it('finalize hits the canonical REGISTERED owner', async () => {
    const calls = stubFetch();
    await (api.registration as any).finalize();
    expect(calls[0].url).toMatch(/\/api\/registration\/finalize$/);
    expect(calls[0].init.method).toBe('POST');
  });

  it('signAgreement posts the three-field payload', async () => {
    const calls = stubFetch();
    await api.enrollment.signAgreement('ENROLL-AGREEMENT-2026', 'Test User', 'v1.0-hash');
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/api\/enrollment\/sign-agreement$/);
    expect(body).toMatchObject({ document_id: 'ENROLL-AGREEMENT-2026', signed_name: 'Test User', document_version_hash: 'v1.0-hash' });
  });

  it('getAgreement fetches the versioned agreement', async () => {
    const calls = stubFetch();
    await api.enrollment.getAgreement();
    expect(calls[0].url).toMatch(/\/api\/enrollment\/agreement$/);
  });

  it('checkDuplicate posts email + dob to the registered route', async () => {
    const calls = stubFetch();
    await api.applications.checkDuplicate('a@b.c', '2000-01-01');
    const body = JSON.parse(calls[0].init.body as string);
    expect(calls[0].url).toMatch(/\/api\/applications\/check-duplicate$/);
    expect(body.email).toBe('a@b.c');
  });

  it('getSections queries by course_id (+ optional term)', async () => {
    const calls = stubFetch();
    await (api.student as any).getSections('c-1', 't-1');
    expect(calls[0].url).toMatch(/\/api\/student\/sections\?course_id=c-1&term_id=t-1$/);
  });
});
