/**
 * Unit tests for PII redaction in logger.ts
 *
 * These verify the audit finding #2 fix:
 *   "Review all console.log statements. Mask emails, student IDs, and names."
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, requestLogger } from './logger';

describe('Logger — PII Redaction', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts email field from log context', () => {
    const log = createLogger('test-worker');
    log.info('User logged in', { email: 'student@bmi.edu', action: 'login' });

    expect(consoleSpy).toHaveBeenCalledOnce();
    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.email).toBe('[REDACTED]');
    expect(emitted.action).toBe('login');
  });

  it('redacts password field', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const log = createLogger('test-worker');
    log.warn('Password change', { password: 'SuperSecret123!', userId: 'abc' });

    const emitted = JSON.parse(warnSpy.mock.calls[0][0] as string);
    expect(emitted.password).toBe('[REDACTED]');
    expect(emitted.userId).toBe('abc');
    warnSpy.mockRestore();
  });

  it('redacts token field', () => {
    const log = createLogger('test-worker');
    log.info('Token issued', { token: 'eyJhbG...', sub: 'user-123' });

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.token).toBe('[REDACTED]');
    expect(emitted.sub).toBe('user-123');
  });

  it('redacts nested PII in objects', () => {
    const log = createLogger('test-worker');
    log.info('Profile update', { user: { email: 'test@bmi.edu', role: 'student' } });

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.user.email).toBe('[REDACTED]');
    expect(emitted.user.role).toBe('student');
  });

  it('preserves non-sensitive fields untouched', () => {
    const log = createLogger('test-worker');
    log.info('Request processed', { path: '/api/v1/courses', status: 200, duration: 42 });

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.path).toBe('/api/v1/courses');
    expect(emitted.status).toBe(200);
    expect(emitted.duration).toBe(42);
  });

  it('redacts multiple sensitive fields in one call', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger('test-worker');
    log.error('Auth failed', {
      email: 'admin@bmi.edu',
      password: 'BadPass',
      token: 'jwt-here',
      name: 'John Doe',
      requestId: 'uuid-abc',
    });

    const emitted = JSON.parse(errorSpy.mock.calls[0][0] as string);
    // All sensitive fields should be masked
    for (const key of ['email', 'password', 'token', 'name']) {
      if (emitted[key]) expect(emitted[key]).toBe('[REDACTED]');
    }
    expect(emitted.requestId).toBe('uuid-abc');
    errorSpy.mockRestore();
  });

  it('emits structured JSON with required fields', () => {
    const log = createLogger('bmi-auth');
    log.info('Health check', {});

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted).toHaveProperty('ts');
    expect(emitted.level).toBe('info');
    expect(emitted.worker).toBe('bmi-auth');
    expect(emitted.msg).toBe('Health check');
  });

  it('child logger inherits parent fields and redacts PII', () => {
    const log = createLogger('bmi-ums');
    const child = log.child({ requestId: 'req-123', email: 'student@bmi.edu' });
    child.info('Child log');

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.requestId).toBe('req-123');
    expect(emitted.email).toBe('[REDACTED]');
  });
});

describe('Logger — requestLogger', () => {
  it('injects method, path, and ray into log entries', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger('bmi-auth');
    const mockRequest = new Request('https://api.example.com/api/auth/login', {
      method: 'POST',
      headers: { 'CF-Ray': 'ray-abc123' },
    });

    const rlog = requestLogger(log, mockRequest);
    rlog.info('Route matched');

    const emitted = JSON.parse(consoleSpy.mock.calls[0][0] as string);
    expect(emitted.method).toBe('POST');
    expect(emitted.path).toBe('/api/auth/login');
    expect(emitted.ray).toBe('ray-abc123');
  });
});
