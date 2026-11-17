/**
 * Unit tests for X-Request-ID request tracing middleware
 *
 * These verify the audit finding #9 fix:
 *   "Implement a X-Request-ID header propagated across Workers."
 */
import { describe, it, expect } from 'vitest';
import { withRequestId, injectTraceHeaders, addTraceToResponse } from './tracing';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('withRequestId', () => {
  it('generates a new UUID when X-Request-ID is absent', () => {
    const req = new Request('https://api.example.com/api/health');
    const { reqId, tracedRequest } = withRequestId(req);

    expect(reqId).toMatch(UUID_REGEX);
    expect(tracedRequest.headers.get('X-Request-ID')).toBe(reqId);
  });

  it('preserves an existing X-Request-ID from upstream', () => {
    const upstreamId = 'existing-trace-id-123';
    const req = new Request('https://api.example.com/api/health', {
      headers: { 'X-Request-ID': upstreamId },
    });
    const { reqId, tracedRequest } = withRequestId(req);

    expect(reqId).toBe(upstreamId);
    expect(tracedRequest.headers.get('X-Request-ID')).toBe(upstreamId);
  });

  it('does not mutate the original request', () => {
    const req = new Request('https://api.example.com/test');
    const { tracedRequest } = withRequestId(req);

    expect(req.headers.get('X-Request-ID')).toBeNull();
    expect(tracedRequest.headers.get('X-Request-ID')).not.toBeNull();
  });

  it('preserves all other headers from original request', () => {
    const req = new Request('https://api.example.com/test', {
      headers: {
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      },
    });
    const { tracedRequest } = withRequestId(req);

    expect(tracedRequest.headers.get('Authorization')).toBe('Bearer token123');
    expect(tracedRequest.headers.get('Content-Type')).toBe('application/json');
  });
});

describe('injectTraceHeaders', () => {
  it('adds X-Request-ID to a RequestInit object', () => {
    const reqId = 'trace-abc';
    const init = injectTraceHeaders({ method: 'POST', body: '{"key":"value"}' }, reqId);
    const headers = new Headers(init.headers as HeadersInit);

    expect(headers.get('X-Request-ID')).toBe(reqId);
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"key":"value"}');
  });

  it('does not overwrite existing headers', () => {
    const init = injectTraceHeaders(
      { headers: { Authorization: 'Bearer xyz', 'Content-Type': 'application/json' } },
      'new-id'
    );
    const headers = new Headers(init.headers as HeadersInit);

    expect(headers.get('Authorization')).toBe('Bearer xyz');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('X-Request-ID')).toBe('new-id');
  });
});

describe('addTraceToResponse', () => {
  it('adds X-Request-ID header to a Response', () => {
    const res = new Response('{"success":true}', { status: 200 });
    const traced = addTraceToResponse(res, 'trace-xyz');

    expect(traced.headers.get('X-Request-ID')).toBe('trace-xyz');
    expect(traced.status).toBe(200);
  });

  it('preserves existing response headers', () => {
    const res = new Response(null, {
      status: 204,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
    const traced = addTraceToResponse(res, 'my-id');

    expect(traced.headers.get('Content-Type')).toBe('application/json');
    expect(traced.headers.get('Cache-Control')).toBe('no-store');
    expect(traced.headers.get('X-Request-ID')).toBe('my-id');
    expect(traced.status).toBe(204);
  });

  it('does not mutate the original response', () => {
    const original = new Response('body', { status: 200 });
    addTraceToResponse(original, 'my-id');
    expect(original.headers.get('X-Request-ID')).toBeNull();
  });
});
