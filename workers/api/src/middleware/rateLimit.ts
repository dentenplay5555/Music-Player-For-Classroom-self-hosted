import { MiddlewareHandler } from 'hono';
import { Env, AppVariables } from '../types';
import { RATE_LIMITS } from '@qr-music/shared';
import { getRoomByCode, parseRoomSettings } from '../services/queueService';

// Sliding rate limiter state
const requestRecords = new Map<string, number[]>();
const lastSuccessRecords = new Map<string, number>();
const failedLoginAttempts = new Map<string, { count: number; lockedUntil: number }>();

let lastCleanup = Date.now();

// Cleanup stale records every 10 minutes to avoid memory leaks
function cleanupStaleRecords(): void {
  const now = Date.now();
  if (now - lastCleanup < 600000) return;
  lastCleanup = now;

  for (const [key, timestamps] of requestRecords.entries()) {
    const valid = timestamps.filter((t) => now - t < 60000);
    if (valid.length === 0) {
      requestRecords.delete(key);
    } else {
      requestRecords.set(key, valid);
    }
  }

  for (const [key, lastTime] of lastSuccessRecords.entries()) {
    if (now - lastTime > 300000) {
      lastSuccessRecords.delete(key);
    }
  }

  for (const [key, record] of failedLoginAttempts.entries()) {
    if (now > record.lockedUntil && now - record.lockedUntil > 900000) {
      failedLoginAttempts.delete(key);
    }
  }
}

/**
 * Extract unique client identifier
 * Prefers x-client-id (persistent device ID generated on client),
 * falling back to Cloudflare connecting IP, x-forwarded-for, or browser fingerprint.
 */
export function getClientIdentifier(c: any): string {
  const customId = c.req.header('x-client-id');
  if (customId && customId.length >= 8 && customId.length <= 64) {
    return customId;
  }
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for') ||
    `ip_${c.req.header('user-agent')?.slice(0, 32) || 'unknown'}`
  );
}

/**
 * Song submission rate limiter:
 * ONLY matches POST /api/v1/rooms/:code/songs
 * Reads dynamic cooldown from room settings!
 */
export const songSubmissionRateLimiter: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  cleanupStaleRecords();

  const path = c.req.path;
  // Strictly target only public /api/v1/rooms/:code/songs (and NOT admin routes!)
  const match = path.match(/^\/api\/v1\/rooms\/([^/]+)\/songs$/);
  if (c.req.method !== 'POST' || !match) {
    return next();
  }

  const roomCode = match[1].toUpperCase();
  const clientId = getClientIdentifier(c);
  const rateKey = `${roomCode}:${clientId}`;
  const now = Date.now();

  // Read actual cooldown configured for this room
  let cooldownSeconds = RATE_LIMITS.MIN_COOLDOWN_SECONDS;
  try {
    const room = await getRoomByCode(c.env.DB, roomCode);
    if (room) {
      const settings = parseRoomSettings(room.settings_json);
      if (typeof settings.cooldownSeconds === 'number' && settings.cooldownSeconds >= 0) {
        cooldownSeconds = settings.cooldownSeconds;
      }
    }
  } catch {}

  // 1. Check cooldown between successful additions
  const lastSuccess = lastSuccessRecords.get(rateKey);
  if (lastSuccess && now - lastSuccess < cooldownSeconds * 1000) {
    const remaining = Math.ceil((cooldownSeconds * 1000 - (now - lastSuccess)) / 1000);
    return c.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMIT_COOLDOWN',
          message: `กรุณารออีก ${remaining} วินาทีก่อนส่งเพลงถัดไป`,
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      429
    );
  }

  // 2. Check requests per minute
  let timestamps = requestRecords.get(rateKey) || [];
  timestamps = timestamps.filter((t) => now - t < 60000);

  if (timestamps.length >= RATE_LIMITS.MAX_REQUESTS_PER_MINUTE) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'คุณส่งคำขอถี่เกินไป กรุณารอ 1 นาที',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      429
    );
  }

  timestamps.push(now);
  requestRecords.set(rateKey, timestamps);

  await next();

  // If request succeeded (200/201), record timestamp for cooldown
  if (c.res.status === 200 || c.res.status === 201) {
    lastSuccessRecords.set(rateKey, Date.now());
  }
};

/**
 * Admin Login Rate Limiter (Brute-force protection)
 */
export const adminLoginRateLimiter: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  cleanupStaleRecords();

  const clientId = getClientIdentifier(c);
  const now = Date.now();
  const record = failedLoginAttempts.get(clientId);

  if (record && record.lockedUntil > now) {
    const waitMin = Math.ceil((record.lockedUntil - now) / 60000);
    return c.json(
      {
        ok: false,
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: `คุณกรอกรหัสผ่านผิดเกินกำหนด ระบบถูกล็อกชั่วคราว กรุณารออีก ${waitMin} นาที`,
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      429
    );
  }

  await next();

  // If login failed (401), increment attempts
  if (c.res.status === 401) {
    const current = failedLoginAttempts.get(clientId) || { count: 0, lockedUntil: 0 };
    current.count++;
    if (current.count >= 5) {
      current.lockedUntil = Date.now() + 15 * 60 * 1000; // Lock for 15 minutes
    }
    failedLoginAttempts.set(clientId, current);
  } else if (c.res.status === 200) {
    // Reset on success
    failedLoginAttempts.delete(clientId);
  }
};
