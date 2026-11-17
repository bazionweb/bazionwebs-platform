/**
 * Security utilities for HKM Church Management System
 * Provides password hashing, encryption, session management, rate limiting, and audit logging
 */

interface WindowWithElectron {
  electronAPI?: {
    isElectron?: boolean;
    secure: {
      encrypt: (value: string) => Promise<ArrayBuffer>;
      decrypt: (buffer: ArrayBuffer) => Promise<string>;
    };
  };
}

// ============================================
// PASSWORD HASHING (using Web Crypto API)
// ============================================

const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  const saltBuffer = new Uint8Array(salt.match(/.{2}/g)!.map((byte) => parseInt(byte, 16)));

  const keyMaterial = await crypto.subtle.importKey('raw', passwordBuffer, 'PBKDF2', false, ['deriveBits']);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_LENGTH,
  );

  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await generateSalt();
  const hash = await deriveKey(password, salt);
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  const derivedHash = await deriveKey(password, salt);
  return derivedHash === hash;
}

// ============================================
// DATA ENCRYPTION (for sensitive localStorage)
// ============================================

const ENCRYPTION_KEY_NAME = 'hkm_encryption_key';

async function getOrCreateEncryptionKey(): Promise<CryptoKey> {
  // In Electron, the main process manages the key, so we don't store it in the renderer.
  // For the web, we continue to use sessionStorage.
  if (!isElectron) {
    const storedKey = sessionStorage.getItem(ENCRYPTION_KEY_NAME);
    if (storedKey) {
      const keyData = JSON.parse(storedKey);
      return await crypto.subtle.importKey('jwk', keyData, { name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
    }
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);

  if (!isElectron) {
    const exportedKey = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(ENCRYPTION_KEY_NAME, JSON.stringify(exportedKey));
  }

  return key;
}

export async function encryptData(data: string): Promise<string> {
  const key = await getOrCreateEncryptionKey();
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data));

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

export async function decryptData(encryptedData: string): Promise<string> {
  try {
    const key = await getOrCreateEncryptionKey();
    const combined = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map((c) => c.charCodeAt(0)),
    );

    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedData; // Return as-is if decryption fails (for migration)
  }
}

// ============================================
// SESSION MANAGEMENT
// ============================================

export interface Session {
  userId: string;
  email: string;
  role: string;
  createdAt: number;
  expiresAt: number;
  token: string;
}

const SESSION_KEY = 'hkm_session_secure';
const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 hours

// Electron secure storage simulation
const isElectron = typeof window !== 'undefined' && (window as unknown as WindowWithElectron).electronAPI?.isElectron;

function generateToken(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Secure storage abstraction for Electron
async function secureSetItem(key: string, value: string): Promise<void> {
  if (isElectron) {
    const encryptedValue = await (window as unknown as WindowWithElectron).electronAPI!.secure.encrypt(value);
    localStorage.setItem(key, btoa(String.fromCharCode(...new Uint8Array(encryptedValue))));
  } else {
    localStorage.setItem(key, value);
  }
}

async function secureGetItem(key: string): Promise<string | null> {
  const storedValue = localStorage.getItem(key);
  if (!storedValue) return null;

  if (isElectron) {
    try {
      const encryptedBuffer = new Uint8Array(
        atob(storedValue)
          .split('')
          .map((c) => c.charCodeAt(0)),
      );
      return await (window as unknown as WindowWithElectron).electronAPI!.secure.decrypt(
        encryptedBuffer.buffer as ArrayBuffer,
      );
    } catch (e) {
      console.error('Decryption failed', e);
      return null;
    }
  }

  return storedValue;
}

async function secureRemoveItem(key: string): Promise<void> {
  localStorage.removeItem(key);
}

export async function createSession(userId: string, email: string, role: string): Promise<Session> {
  const now = Date.now();
  const session: Session = {
    userId,
    email,
    role,
    createdAt: now,
    expiresAt: now + SESSION_DURATION,
    token: generateToken(),
  };

  await secureSetItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function getSession(): Promise<Session | null> {
  const stored = await secureGetItem(SESSION_KEY);
  if (!stored) return null;

  try {
    const session: Session = JSON.parse(stored);

    if (Date.now() > session.expiresAt) {
      await clearSession();
      return null;
    }

    return session;
  } catch {
    await clearSession();
    return null;
  }
}

export async function refreshSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;

  session.expiresAt = Date.now() + SESSION_DURATION;
  await secureSetItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function clearSession(): Promise<void> {
  await secureRemoveItem(SESSION_KEY);
  sessionStorage.removeItem(ENCRYPTION_KEY_NAME);
}

export async function isSessionValid(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

// ============================================
// ROLE-BASED ACCESS CONTROL (RBAC)
// ============================================

export type Permission =
  | 'view_dashboard'
  | 'manage_members'
  | 'manage_finance'
  | 'manage_attendance'
  | 'manage_equipment'
  | 'manage_visitors'
  | 'send_sms'
  | 'manage_users'
  | 'manage_settings'
  | 'view_reports'
  | 'export_data'
  | 'import_data';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  Admin: [
    'view_dashboard',
    'manage_members',
    'manage_finance',
    'manage_attendance',
    'manage_equipment',
    'manage_visitors',
    'send_sms',
    'manage_users',
    'manage_settings',
    'view_reports',
    'export_data',
    'import_data',
  ],
  Staff: ['view_dashboard', 'manage_members', 'manage_attendance', 'manage_visitors', 'send_sms', 'view_reports'],
  Volunteer: ['view_dashboard', 'manage_attendance', 'view_reports'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

export function getPermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export async function requirePermission(permission: Permission): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return hasPermission(session.role, permission);
}

// ============================================
// CSRF PROTECTION
// ============================================

const CSRF_TOKEN_KEY = 'hkm_csrf_token';

export function generateCSRFToken(): string {
  const array = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function getCSRFToken(): Promise<string> {
  let token = sessionStorage.getItem(CSRF_TOKEN_KEY);

  if (!token) {
    token = generateCSRFToken();
    sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  }

  return token;
}

export async function validateCSRFToken(token: string): Promise<boolean> {
  const storedToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  return storedToken !== null && storedToken === token;
}

export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
}

// ============================================
// RATE LIMITING
// ============================================

interface RateLimitEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil: number | null;
}

const RATE_LIMIT_KEY = 'hkm_rate_limit';
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 30 * 60 * 1000; // 30 minutes lockout

function getRateLimitData(): Record<string, RateLimitEntry> {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Record<string, RateLimitEntry>;
      // Clean expired entries while reading
      const now = Date.now();
      for (const key of Object.keys(parsed)) {
        const entry = parsed[key];
        if (entry.lockedUntil && now >= entry.lockedUntil) {
          delete parsed[key];
        } else if (now - entry.firstAttempt > WINDOW_MS) {
          delete parsed[key];
        }
      }
      return parsed;
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

function saveRateLimitData(data: Record<string, RateLimitEntry>): void {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable — rate limiting degrades gracefully
  }
}

export function checkRateLimit(identifier: string): {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: number | null;
} {
  const data = getRateLimitData();
  const entry = data[identifier];
  const now = Date.now();

  if (!entry) {
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }

  // Check if locked out
  if (entry.lockedUntil && now < entry.lockedUntil) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: entry.lockedUntil };
  }

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    delete data[identifier];
    saveRateLimitData(data);
    return { allowed: true, remainingAttempts: MAX_ATTEMPTS, lockedUntil: null };
  }

  const remaining = MAX_ATTEMPTS - entry.attempts;
  return { allowed: remaining > 0, remainingAttempts: Math.max(0, remaining), lockedUntil: entry.lockedUntil };
}

export function recordLoginAttempt(identifier: string, success: boolean): void {
  const data = getRateLimitData();
  const now = Date.now();

  if (success) {
    delete data[identifier];
    saveRateLimitData(data);
    return;
  }

  const entry = data[identifier] || { attempts: 0, firstAttempt: now, lockedUntil: null };

  // Reset if window expired
  if (now - entry.firstAttempt > WINDOW_MS) {
    entry.attempts = 0;
    entry.firstAttempt = now;
    entry.lockedUntil = null;
  }

  entry.attempts++;

  if (entry.attempts >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }

  data[identifier] = entry;
  saveRateLimitData(data);
}

export function getRemainingLockoutTime(identifier: string): number {
  const data = getRateLimitData();
  const entry = data[identifier];

  if (!entry?.lockedUntil) return 0;

  const remaining = entry.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

import { SecureStorage } from './SecureStorage';

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  userId: string | null;
  userEmail: string;
  action: string;
  resource: string;
  resourceId?: string | number;
  details?: string;
  ipAddress?: string;
}

const AUDIT_LOG_KEY = 'hkm_audit_log_secure';
const AUDIT_LOG_ARCHIVE_KEY_PREFIX = 'hkm_audit_log_archive_';
const MAX_AUDIT_ENTRIES = 100; // Increased from 5 for production use
const MAX_ARCHIVES = 10;
const AUDIT_LOG_BUFFER_FLUSH_DELAY = 2000; // 2 seconds buffer delay

const auditLogStorage = new SecureStorage(AUDIT_LOG_KEY);
const auditLogArchiveStorage: SecureStorage[] = Array.from(
  { length: MAX_ARCHIVES },
  (_, i) => new SecureStorage(`${AUDIT_LOG_ARCHIVE_KEY_PREFIX}${i}`),
);

// Write-behind buffer for audit logs
let auditLogBuffer: AuditLogEntry[] = [];
let flushTimeout: number | null = null;
let isFlushing = false;

function redactEmail(email: string): string {
  if (!email || email === 'anonymous') return 'anonymous';
  const [user, domain] = email.split('@');
  return `${user.substring(0, 2)}...${user.slice(-1)}@${domain}`;
}

// Buffer management functions
async function flushAuditBuffer(): Promise<void> {
  if (isFlushing || auditLogBuffer.length === 0) {
    return;
  }

  isFlushing = true;

  try {
    const logs = await getAuditLogs();
    const bufferCopy = [...auditLogBuffer];

    // Add buffered entries to current logs
    logs.unshift(...bufferCopy);

    // Handle log rotation if needed
    if (logs.length > MAX_AUDIT_ENTRIES) {
      const archiveLogs = logs.splice(MAX_AUDIT_ENTRIES);
      const archiveIndex = (parseInt(localStorage.getItem('hkm_audit_archive_index') || '0') + 1) % MAX_ARCHIVES;

      await auditLogArchiveStorage[archiveIndex].setItem(JSON.stringify(archiveLogs));
      localStorage.setItem('hkm_audit_archive_index', archiveIndex.toString());
    }

    await auditLogStorage.setItem(JSON.stringify(logs));

    // Clear the buffer after successful flush
    auditLogBuffer = [];
  } catch (error) {
    console.error('Failed to flush audit buffer:', error);
    // Keep the buffer content for retry
  } finally {
    isFlushing = false;
    flushTimeout = null;
  }
}

function scheduleBufferFlush(): void {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }

  flushTimeout = window.setTimeout(() => {
    flushAuditBuffer();
  }, AUDIT_LOG_BUFFER_FLUSH_DELAY);
}

export async function logAuditEvent(
  action: string,
  resource: string,
  resourceId?: string | number,
  details?: string,
): Promise<void> {
  const session = await getSession();

  const entry: AuditLogEntry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    userId: session?.userId || null,
    userEmail: redactEmail(session?.email || 'anonymous'),
    action,
    resource,
    resourceId,
    details,
  };

  // Add to buffer instead of immediate write
  auditLogBuffer.unshift(entry);

  // Schedule flush if not already scheduled
  if (!flushTimeout) {
    scheduleBufferFlush();
  }

  // Immediate flush if buffer reaches certain size
  if (auditLogBuffer.length >= 20) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    await flushAuditBuffer();
  }
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  // First flush any pending buffer to ensure we get all logs
  if (auditLogBuffer.length > 0) {
    await flushAuditBuffer();
  }

  const stored = await auditLogStorage.getItem();
  return stored ? JSON.parse(stored) : [];
}

// Force immediate flush of audit buffer
export async function flushAuditLogs(): Promise<void> {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  await flushAuditBuffer();
}

// Get current buffer size (for monitoring)
export function getAuditBufferSize(): number {
  return auditLogBuffer.length;
}

// Get buffer contents (for debugging)
export function getAuditBufferContents(): AuditLogEntry[] {
  return [...auditLogBuffer];
}

export async function getArchivedAuditLogs(archiveIndex: number): Promise<AuditLogEntry[]> {
  if (archiveIndex < 0 || archiveIndex >= MAX_ARCHIVES) return [];
  const stored = await auditLogArchiveStorage[archiveIndex].getItem();
  return stored ? JSON.parse(stored) : [];
}

export function clearAuditLogs(): void {
  localStorage.removeItem(AUDIT_LOG_KEY);
}

// Predefined audit actions
export const AuditActions = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  PASSWORD_RESET: 'PASSWORD_RESET',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  MEMBER_CREATED: 'MEMBER_CREATED',
  MEMBER_UPDATED: 'MEMBER_UPDATED',
  MEMBER_DELETED: 'MEMBER_DELETED',
  TRANSACTION_CREATED: 'TRANSACTION_CREATED',
  TRANSACTION_DELETED: 'TRANSACTION_DELETED',
  DATA_EXPORTED: 'DATA_EXPORTED',
  DATA_IMPORTED: 'DATA_IMPORTED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  SMS_SENT: 'SMS_SENT',
  TWO_FA_ENABLED: 'TWO_FA_ENABLED',
  TWO_FA_DISABLED: 'TWO_FA_DISABLED',
  TWO_FA_VERIFIED: 'TWO_FA_VERIFIED',
} as const;

// ============================================
// INPUT SANITIZATION
// ============================================

export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeInput(value);
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized as T;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ============================================
// TWO-FACTOR AUTHENTICATION (TOTP)
// ============================================

const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_STORAGE_KEY = 'hkm_2fa_secrets';

// Generate a random secret for TOTP (Base32 encoded)
export function generate2FASecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const secretLength = 16;
  let secret = '';
  const randomValues = crypto.getRandomValues(new Uint8Array(secretLength));
  for (let i = 0; i < secretLength; i++) {
    secret += chars[randomValues[i] % chars.length];
  }
  return secret;
}

// Base32 decode helper
function base32Decode(encoded: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of encoded.toUpperCase()) {
    const val = chars.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, (i + 1) * 8), 2);
  }
  return bytes;
}

// Generate TOTP code from secret
export async function generateTOTP(secret: string, timeOffset: number = 0): Promise<string> {
  const counter = Math.floor((Date.now() / 1000 + timeOffset) / TOTP_PERIOD);
  const counterBytes = new Uint8Array(8);
  let temp = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  const keyBytes = base32Decode(secret);
  const key = await crypto.subtle.importKey('raw', new Uint8Array(keyBytes), { name: 'HMAC', hash: 'SHA-1' }, false, [
    'sign',
  ]);

  const signature = await crypto.subtle.sign('HMAC', key, counterBytes);
  const hash = new Uint8Array(signature);

  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

// Verify TOTP code (allows 1 period drift for clock skew)
export async function verifyTOTP(secret: string, code: string): Promise<boolean> {
  const normalizedCode = code.replace(/\s/g, '');

  // Check current period and adjacent periods for clock skew tolerance
  for (const offset of [0, -TOTP_PERIOD, TOTP_PERIOD]) {
    const expectedCode = await generateTOTP(secret, offset);
    if (expectedCode === normalizedCode) {
      return true;
    }
  }
  return false;
}

// Store 2FA secret for a user
export async function store2FASecret(userId: string, secret: string): Promise<void> {
  const secrets = await get2FASecrets();
  secrets[userId] = {
    secret,
    enabled: false,
    createdAt: Date.now(),
  };
  const encrypted = await encryptData(JSON.stringify(secrets));
  localStorage.setItem(TOTP_STORAGE_KEY, encrypted);
}

// Enable 2FA for a user (after they verify their first code)
export async function enable2FA(userId: string): Promise<boolean> {
  const secrets = await get2FASecrets();
  if (secrets[userId]) {
    secrets[userId].enabled = true;
    secrets[userId].enabledAt = Date.now();
    const encrypted = await encryptData(JSON.stringify(secrets));
    localStorage.setItem(TOTP_STORAGE_KEY, encrypted);
    logAuditEvent(AuditActions.SETTINGS_CHANGED, '2fa', userId, '2FA enabled');
    return true;
  }
  return false;
}

// Disable 2FA for a user
export async function disable2FA(userId: string): Promise<void> {
  const secrets = await get2FASecrets();
  delete secrets[userId];
  const encrypted = await encryptData(JSON.stringify(secrets));
  localStorage.setItem(TOTP_STORAGE_KEY, encrypted);
  logAuditEvent(AuditActions.SETTINGS_CHANGED, '2fa', userId, '2FA disabled');
}

// Check if user has 2FA enabled
export async function is2FAEnabled(userId: string): Promise<boolean> {
  const secrets = await get2FASecrets();
  return secrets[userId]?.enabled === true;
}

// Get user's 2FA secret (for verification)
export async function get2FASecret(userId: string): Promise<string | null> {
  const secrets = await get2FASecrets();
  return secrets[userId]?.secret || null;
}

// Get all 2FA secrets (handles both legacy plaintext and encrypted formats)
async function get2FASecrets(): Promise<
  Record<string, { secret: string; enabled: boolean; createdAt: number; enabledAt?: number }>
> {
  try {
    const stored = localStorage.getItem(TOTP_STORAGE_KEY);
    if (!stored) return {};
    try {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      /* ignore parse errors for migration */
    }
    try {
      const decrypted = await decryptData(stored);
      if (decrypted !== stored) {
        localStorage.setItem(TOTP_STORAGE_KEY, decrypted);
        return JSON.parse(decrypted);
      }
    } catch {
      /* ignore decrypt errors for migration */
    }
    return {};
  } catch {
    /* ignore top-level errors */ return {};
  }
}

// Generate QR code URL for authenticator apps (Google Authenticator, Authy, etc.)
export function get2FAQRCodeURL(email: string, secret: string, issuer: string = 'HKM Church'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  const otpauthUrl = `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
  // Return URL for QR code generation service
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`;
}

// ============================================
// PASSWORD POLICY
// ============================================

export const MIN_PASSWORD_LENGTH = 12;
export const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
export const PASSWORD_MAX_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days

// Validate password strength with enhanced requirements
export function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long` };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
  }

  // Check for common patterns and weak passwords
  if (password.toLowerCase().includes('password')) {
    return { valid: false, message: 'Password cannot contain the word "password"' };
  }

  if (/(.)\1{2,}/.test(password)) {
    return { valid: false, message: 'Password cannot contain repeating characters' };
  }

  if (/^[0-9]+$/.test(password)) {
    return { valid: false, message: 'Password cannot be all numbers' };
  }

  if (/^[a-zA-Z]+$/.test(password)) {
    return { valid: false, message: 'Password cannot be all letters' };
  }

  return { valid: true, message: 'Password meets security requirements' };
}

// Check if password has expired
export function isPasswordExpired(lastChanged: number): boolean {
  return Date.now() - lastChanged > PASSWORD_MAX_AGE;
}

// Validate password against common breach databases (simulated)
export async function isPasswordBreached(password: string): Promise<boolean> {
  // In a real implementation, this would check against breach databases
  // For now, we'll simulate checking against common weak passwords
  const commonPasswords = [
    'password',
    '123456',
    'qwerty',
    'letmein',
    'welcome',
    'admin',
    '123456789',
    'password1',
    '12345678',
    '12345',
    '1234567',
    '123123',
    '000000',
    'admin123',
  ];

  return commonPasswords.includes(password.toLowerCase());
}
