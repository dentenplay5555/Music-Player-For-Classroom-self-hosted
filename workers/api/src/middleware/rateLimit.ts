import { MiddlewareHandler } from 'hono';
import { Env, AppVariables } from '../types';
import { RATE_LIMITS } from '@qr-music/shared';

// In-memory sliding rate limiter per Worker isolate
const requestRecords = new Map<string, number[]>();
const lastSuccessRecords = new Map<string, number>();

export const rateLimiter: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (
  c,
  next
) => {
  // Only apply rate limiting to song submissions
  if (c.req.method !== 'POST' || !c.req.path.includes('/songs')) {
    return next();
  }

  const clientIp =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for') ||
    'anonymous-client';

  const now = Date.now();

  // 1. Check cooldown (min 5 seconds between successful adds)
  const lastSuccess = lastSuccessRecords.get(clientIp);
  if (lastSuccess && now - lastSuccess < RATE_LIMITS.MIN_COOLDOWN_SECONDS * 1000) {
    const waitSec = Math.ceil((RATE_LIMITS.MIN_COOLDOWN_SECONDS * 1000 - (now - lastSuccess)) / 1000);
    return c.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMIT_COOLDOWN',
          message: `กรุณารออีก ${waitSec} วินาทีก่อนส่งเพลงถัดไป`,
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      429
    );
  }

  // 2. Check requests per minute
  let timestamps = requestRecords.get(clientIp) || [];
  timestamps = timestamps.filter((t) => now - t < 60000);

  if (timestamps.length >= RATE_LIMITS.MAX_REQUESTS_PER_MINUTE) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'คุณส่งเพลงถี่เกินไป กรุณารอ 1 นาที',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      429
    );
  }

  timestamps.push(now);
  requestRecords.set(clientIp, timestamps);

  await next();

  // If request succeeded (200/201), update cooldown
  if (c.res.status === 200 || c.res.status === 201) {
    lastSuccessRecords.set(clientIp, Date.now());
  }
};
