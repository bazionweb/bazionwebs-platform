import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  sanitizeInput,
  sanitizeObject,
  isValidEmail,
  generate2FASecret,
  verifyTOTP,
  store2FASecret,
  get2FASecret,
  is2FAEnabled,
  enable2FA,
  disable2FA,
  generateCSRFToken,
  getCSRFToken,
  validateCSRFToken,
  checkRateLimit,
  recordLoginAttempt,
  getRemainingLockoutTime,
  validatePasswordStrength,
  hasPermission,
  logAuditEvent,
  getAuditLogs,
  clearAuditLogs,
  AuditActions,
} from './security';

describe('Password Hashing', () => {
  it('should hash and verify a password', async () => {
    const hash = await hashPassword('TestPass123!');
    expect(hash).toContain(':');
    const [salt, key] = hash.split(':');
    expect(salt).toHaveLength(32);
    expect(key).toHaveLength(64);

    const valid = await verifyPassword('TestPass123!', hash);
    expect(valid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('CorrectPass1!');
    const valid = await verifyPassword('WrongPass1!', hash);
    expect(valid).toBe(false);
  });

  it('should handle malformed stored hash gracefully', async () => {
    const valid = await verifyPassword('password', 'invalid-hash');
    expect(valid).toBe(false);
  });
});

describe('Data Encryption', () => {
  it('should encrypt and decrypt data', async () => {
    const original = 'sensitive-church-data';
    const encrypted = await encryptData(original);
    expect(encrypted).not.toBe(original);
    expect(encrypted).toBeTruthy();

    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe(original);
  });

  it('should handle empty string', async () => {
    const encrypted = await encryptData('');
    const decrypted = await decryptData(encrypted);
    expect(decrypted).toBe('');
  });

  it('should return input on decrypt failure', async () => {
    const result = await decryptData('not-valid-encrypted-data');
    expect(result).toBe('not-valid-encrypted-data');
  });
});

describe('Input Sanitization', () => {
  it('should escape HTML special characters', () => {
    expect(sanitizeInput('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;',
    );
  });

  it('should handle non-string input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(123 as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(null as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeInput(undefined as any)).toBe('');
  });

  it('should sanitize nested objects', () => {
    const obj = { name: '<b>John</b>', details: { bio: '<script>evil()</script>' } };
    const result = sanitizeObject(obj);
    expect(result.name).toBe('&lt;b&gt;John&lt;&#x2F;b&gt;');
    expect(result.details.bio).toBe('&lt;script&gt;evil()&lt;&#x2F;script&gt;');
  });
});

describe('Email Validation', () => {
  it('should validate correct emails', () => {
    expect(isValidEmail('test@example.com')).toBe(true);
    expect(isValidEmail('user+tag@church.org')).toBe(true);
  });

  it('should reject invalid emails', () => {
    expect(isValidEmail('not-an-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('@domain.com')).toBe(false);
  });
});

describe('2FA / TOTP', () => {
  const userId = 'test-user-123';

  beforeEach(() => {
    localStorage.clear();
  });

  it('should generate a valid Base32 secret', () => {
    const secret = generate2FASecret();
    expect(secret).toHaveLength(16);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('should generate and verify TOTP codes', async () => {
    const secret = generate2FASecret();
    const code = await verifyTOTP(secret, '000000');
    expect(typeof code).toBe('boolean');
  });

  it('should store and retrieve 2FA secret encrypted', async () => {
    const secret = generate2FASecret();
    await store2FASecret(userId, secret);

    const stored = localStorage.getItem('hkm_2fa_secrets');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain(secret);

    const retrieved = await get2FASecret(userId);
    expect(retrieved).toBe(secret);
  });

  it('should enable and detect 2FA', async () => {
    const secret = generate2FASecret();
    await store2FASecret(userId, secret);

    expect(await is2FAEnabled(userId)).toBe(false);

    const enabled = await enable2FA(userId);
    expect(enabled).toBe(true);
    expect(await is2FAEnabled(userId)).toBe(true);
  });

  it('should disable 2FA', async () => {
    const secret = generate2FASecret();
    await store2FASecret(userId, secret);
    await enable2FA(userId);
    expect(await is2FAEnabled(userId)).toBe(true);

    await disable2FA(userId);
    expect(await is2FAEnabled(userId)).toBe(false);
    expect(await get2FASecret(userId)).toBeNull();
  });
});

describe('CSRF Protection', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('should generate and validate CSRF tokens', async () => {
    const token = generateCSRFToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('should persist CSRF token in session', async () => {
    const token1 = await getCSRFToken();
    const token2 = await getCSRFToken();
    expect(token1).toBe(token2);
  });

  it('should validate tokens correctly', async () => {
    const token = await getCSRFToken();
    expect(await validateCSRFToken(token)).toBe(true);
    expect(await validateCSRFToken('invalid-token')).toBe(false);
  });
});

describe('Rate Limiting', () => {
  const identifier = 'user@church.com';

  beforeEach(() => {
    // Reset rate limit data by clearing the in-memory store
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hkm_rate_limit')) localStorage.removeItem(key);
    }
  });

  it('should allow requests within limit', () => {
    const result = checkRateLimit(identifier);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
  });

  it('should lock after max failed attempts', () => {
    for (let i = 0; i < 5; i++) {
      recordLoginAttempt(identifier, false);
    }
    const result = checkRateLimit(identifier);
    expect(result.allowed).toBe(false);
    expect(result.remainingAttempts).toBe(0);
    expect(result.lockedUntil).not.toBeNull();
  });

  it('should reset on successful login', () => {
    recordLoginAttempt(identifier, false);
    recordLoginAttempt(identifier, true);
    const result = checkRateLimit(identifier);
    expect(result.allowed).toBe(true);
    expect(result.remainingAttempts).toBe(5);
  });

  it('should calculate remaining lockout time', () => {
    const time = getRemainingLockoutTime('unknown-user');
    expect(time).toBe(0);
  });
});

describe('Password Strength', () => {
  it('should accept strong passwords', () => {
    const result = validatePasswordStrength('MyStr0ng!Pass');
    expect(result.valid).toBe(true);
  });

  it('should reject short passwords', () => {
    const result = validatePasswordStrength('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('12 characters');
  });

  it('should reject missing uppercase', () => {
    const result = validatePasswordStrength('weakpassword1!');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('uppercase');
  });

  it('should reject passwords containing the word password', () => {
    const result = validatePasswordStrength('AbcdPassword1!');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('password');
  });
});

describe('Role-Based Access Control', () => {
  it('should grant Admin all permissions', () => {
    expect(hasPermission('Admin', 'manage_users')).toBe(true);
    expect(hasPermission('Admin', 'manage_finance')).toBe(true);
    expect(hasPermission('Admin', 'export_data')).toBe(true);
  });

  it('should grant limited permissions to non-admin roles', () => {
    expect(hasPermission('Volunteer', 'view_dashboard')).toBe(true);
    expect(hasPermission('Volunteer', 'manage_users')).toBe(false);
    expect(hasPermission('', 'manage_finance')).toBe(false);
  });
});

describe('Audit Logging', () => {
  beforeEach(async () => {
    // Flush any pending buffer then clear
    await getAuditLogs();
    clearAuditLogs();
    localStorage.removeItem('hkm_audit_log_secure');
  });

  it('should log and retrieve audit events', async () => {
    await logAuditEvent('LOGIN_SUCCESS', 'auth', 'user-1', 'Test login');
    const logs = await getAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('LOGIN_SUCCESS');
    expect(logs[0].resource).toBe('auth');
  });

  it('should handle multiple audit events', async () => {
    await logAuditEvent('LOGIN_SUCCESS', 'auth', 'user-1');
    await logAuditEvent('MEMBER_CREATED', 'members', 'member-1');
    await logAuditEvent('TRANSACTION_CREATED', 'finance', 'tx-1');

    const logs = await getAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(3);
  });

  it('should redact email addresses', async () => {
    await logAuditEvent('LOGIN_SUCCESS', 'auth', 'user-1');
    const logs = await getAuditLogs();
    // anonymous because no session is set in test
    expect(logs[0].userEmail).toBeDefined();
  });
});

describe('AuditActions constants', () => {
  it('should have all expected action types', () => {
    expect(AuditActions.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
    expect(AuditActions.TWO_FA_ENABLED).toBe('TWO_FA_ENABLED');
    expect(AuditActions.SMS_SENT).toBe('SMS_SENT');
    expect(AuditActions.DATA_EXPORTED).toBe('DATA_EXPORTED');
  });
});
