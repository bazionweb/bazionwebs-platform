/**
 * Unit tests for JWT signing, verification, and password hashing
 *
 * These cover the authentication core that underpins the entire system.
 */
import { describe, it, expect } from 'vitest';
import { signJWT, verifyJWT, hashPassword, verifyPassword, validatePasswordStrength, isCommonPassword } from './jwt';

describe('signJWT / verifyJWT', () => {
  const secret = 'test-secret-key-for-unit-tests-32chars';

  it('signs and verifies a valid JWT', async () => {
    const payload = { sub: 'user-123', role: 'student' };
    const token = await signJWT(payload, secret, 3600);
    const verified = await verifyJWT(token, secret);

    expect(verified).not.toBeNull();
    expect(verified!.sub).toBe('user-123');
    expect(verified!.role).toBe('student');
  });

  it('returns null for expired JWT', async () => {
    // Sign with -1 second expiry (already expired)
    const token = await signJWT({ sub: 'user-123' }, secret, -1);
    const result = await verifyJWT(token, secret);
    expect(result).toBeNull();
  });

  it('returns null for token with wrong secret', async () => {
    const token = await signJWT({ sub: 'user-123' }, secret);
    const result = await verifyJWT(token, 'wrong-secret');
    expect(result).toBeNull();
  });

  it('returns null for malformed token', async () => {
    expect(await verifyJWT('not.a.token', secret)).toBeNull();
    expect(await verifyJWT('', secret)).toBeNull();
    expect(await verifyJWT('only.two', secret)).toBeNull();
  });

  it('includes iat and exp in signed tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await signJWT({ sub: 'x' }, secret, 3600);
    const verified = await verifyJWT(token, secret);

    expect(verified!.iat).toBeGreaterThanOrEqual(now - 1);
    expect(verified!.exp).toBeCloseTo(now + 3600, -1);
  });
});

describe('hashPassword / verifyPassword', () => {
  const pepper = 'test-pepper-value';

  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('SecurePass1!', pepper);
    const valid = await verifyPassword('SecurePass1!', hash, pepper);
    expect(valid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('CorrectPass1!', pepper);
    const valid = await verifyPassword('WrongPass1!', hash, pepper);
    expect(valid).toBe(false);
  });

  it('hashes are unique (salted)', async () => {
    const hash1 = await hashPassword('SamePass1!', pepper);
    const hash2 = await hashPassword('SamePass1!', pepper);
    expect(hash1).not.toBe(hash2);
  });

  it('returns false for invalid stored hash format', async () => {
    const result = await verifyPassword('pass', 'invalid-hash', pepper);
    expect(result).toBe(false);
  });
});

describe('pepper fallback agreement (registration ↔ login)', () => {
  it('hash and verify agree when PASSWORD_PEPPER is unset', async () => {
    // Registration falls back to DEFAULT_PASSWORD_PEPPER when the env secret is
    // missing; login must verify against the same default or every login 401s.
    const hash = await hashPassword('SecurePass1!', '');
    const valid = await verifyPassword('SecurePass1!', hash, '');
    expect(valid).toBe(true);
  });

  it('default pep other than the fallback must not verify a fallback hash', async () => {
    const hash = await hashPassword('SecurePass1!', '');
    const valid = await verifyPassword('SecurePass1!', hash, 'different-pepper');
    expect(valid).toBe(false);
  });
});

describe('validatePasswordStrength', () => {
  it('accepts a strong password', () => {
    const result = validatePasswordStrength('StrongP@ss1');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects short password', () => {
    const result = validatePasswordStrength('Sh0rt!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters');
  });

  it('rejects password without uppercase', () => {
    const result = validatePasswordStrength('nouppercase1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain an uppercase letter');
  });

  it('rejects password without digit', () => {
    const result = validatePasswordStrength('NoDigitHere!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain a number');
  });

  it('rejects password without special character', () => {
    const result = validatePasswordStrength('NoSpecial12');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain a special character');
  });
});

describe('isCommonPassword', () => {
  it('detects common passwords', () => {
    expect(isCommonPassword('password')).toBe(true);
    expect(isCommonPassword('password123')).toBe(true);
    expect(isCommonPassword('123456789')).toBe(true);
    expect(isCommonPassword('admin123')).toBe(true);
  });

  it('does not flag uncommon passwords', () => {
    expect(isCommonPassword('Xk9#mP!vLq2@')).toBe(false);
    expect(isCommonPassword('UniquePhrase99!')).toBe(false);
  });
});
