const PIN_ITERATIONS = 600000; // OWASP 2023 recommended minimum for PBKDF2-HMAC-SHA256

export async function hashPin(memberId: string, pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBuffer = encoder.encode(memberId); // memberId as salt
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);

  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBuffer, iterations: PIN_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );

  return Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
