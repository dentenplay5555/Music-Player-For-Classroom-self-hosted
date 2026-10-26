/**
 * Cryptographic and security utilities using Web Crypto API
 */

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  // Length check done in constant time via XOR accumulation to avoid early exit
  // We pad to the same length to prevent length-based timing leaks.
  const len = Math.max(aBuf.byteLength, bBuf.byteLength);
  let diff = aBuf.byteLength ^ bBuf.byteLength; // non-zero if lengths differ
  for (let i = 0; i < len; i++) {
    diff |= (aBuf[i] ?? 0) ^ (bBuf[i] ?? 0);
  }
  return diff === 0;
}

export function generateSecureRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = new Uint8Array(length);
  crypto.getRandomValues(randomBytes);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

export function generateSecureToken(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function signAdminToken(secret: string, expiresInHours = 24): Promise<string> {
  const encoder = new TextEncoder();
  const exp = Date.now() + expiresInHours * 3600 * 1000;
  const payload = JSON.stringify({ role: 'admin', exp, jti: crypto.randomUUID() });
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const b64Payload = btoa(payload).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${b64Payload}.${b64Sig}`;
}

export async function verifyAdminToken(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [b64Payload, b64Sig] = parts;

    // Base64Url decode
    const padPayload = b64Payload.padEnd(b64Payload.length + ((4 - (b64Payload.length % 4)) % 4), '=');
    const rawPayload = atob(padPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(rawPayload);

    // Check expiration
    if (!payload.exp || typeof payload.exp !== 'number' || Date.now() > payload.exp) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const padSig = b64Sig.padEnd(b64Sig.length + ((4 - (b64Sig.length % 4)) % 4), '=');
    const sigBin = atob(padSig.replace(/-/g, '+').replace(/_/g, '/'));
    const sigBytes = Uint8Array.from(sigBin, (c) => c.charCodeAt(0));

    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(rawPayload));
  } catch {
    return false;
  }
}
