export async function signJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 60 * 60 * 24 * 7
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresInSeconds };

  const base64Header = btoa(JSON.stringify(header)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const base64Payload = btoa(JSON.stringify(fullPayload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${base64Header}.${base64Payload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${base64Sig}`;
}

export async function verifyJWT(token: string, secret: string): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [base64Header, base64Payload, base64Sig] = parts;
    const data = `${base64Header}.${base64Payload}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = Uint8Array.from(atob(base64Sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
    if (!valid) return null;

    const payload = JSON.parse(atob(base64Payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

const DEFAULT_PBKDF2_ITERATIONS = 40000;

/**
 * Fallback pepper used when PASSWORD_PEPPER is unset, so registration and login
 * always agree on the pepper. Must match the value previously used in
 * apps/api/routes/auth.ts so existing accounts keep verifying.
 */
export const DEFAULT_PASSWORD_PEPPER = 'bmi-default-pepper-2026'; // gitleaks:allow

function resolvePepper(pepper?: string): string {
  return pepper && pepper.trim() !== '' ? pepper : DEFAULT_PASSWORD_PEPPER;
}

function resolveIterations(iterations?: number | string): number {
  if (iterations === undefined || iterations === '') return DEFAULT_PBKDF2_ITERATIONS;
  if (typeof iterations === 'string') {
    const n = parseInt(iterations, 10);
    if (isNaN(n) || n < 1000) return DEFAULT_PBKDF2_ITERATIONS;
    return n;
  }
  if (iterations < 1000) return DEFAULT_PBKDF2_ITERATIONS;
  return iterations;
}

export async function hashPassword(password: string, pepper: string, iterations?: number | string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  const pepperKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(resolvePepper(pepper)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const pepperedPassword = await crypto.subtle.sign('HMAC', pepperKey, new TextEncoder().encode(password));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pepperedPassword,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const iter = resolveIterations(iterations);
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${iter}:${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, stored: string, pepper: string): Promise<boolean> {
  try {
    const parts = stored.split(':');
    let iterations = 50000;
    let saltHex: string, storedHash: string;

    if (parts.length === 4) {
      iterations = parseInt(parts[1], 10);
      saltHex = parts[2];
      storedHash = parts[3];
    } else if (parts.length === 3) {
      saltHex = parts[1];
      storedHash = parts[2];
    } else {
      return false;
    }

    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    
    const pepperKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(resolvePepper(pepper)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const pepperedPassword = await crypto.subtle.sign('HMAC', pepperKey, new TextEncoder().encode(password));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pepperedPassword,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (hashHex.length !== storedHash.length) return false;
    let mismatch = 0;
    for (let i = 0; i < hashHex.length; i++) {
      mismatch |= hashHex.charCodeAt(i) ^ storedHash.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a special character');
  return { valid: errors.length === 0, errors };
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'Password1', 'Password123', 'password123',
  '12345678', '123456789', 'qwerty123', 'admin123', 'letmein',
  'welcome', 'monkey', 'dragon', 'master', 'abc123',
]);

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.toLowerCase());
}
