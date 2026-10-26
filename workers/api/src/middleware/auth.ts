import { MiddlewareHandler } from 'hono';
import { Env, AppVariables } from '../types';
import { verifyAdminToken, timingSafeEqual } from '../services/crypto';
import { getRoomByCode } from '../services/queueService';

export const adminAuthMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const adminPassword = c.env.ADMIN_PASSWORD || 'TM-OPERA_O';

  // Check Authorization header or x-admin-token
  const authHeader = c.req.header('Authorization');
  let token = '';

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    token =
      c.req.header('x-admin-token') ||
      c.req.header('x-admin-password') ||
      '';
  }

  if (!token) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'กรุณาเข้าสู่ระบบ Admin ก่อนทำรายการ',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      401
    );
  }

  // 1. Verify signed HMAC token
  const isValidSignedToken = await verifyAdminToken(token, adminPassword);
  // 2. Or constant-time check with adminPassword (for direct API/CLI usage)
  const isDirectPassword = timingSafeEqual(token, adminPassword);

  if (!isValidSignedToken && !isDirectPassword) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Token ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาเข้าสู่ระบบใหม่',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      401
    );
  }

  await next();
};

/**
 * Middleware ensuring player-only actions (like skipping or heartbeat)
 * require a valid player token (or admin token) to prevent random spectators
 * from hijacking playback.
 */
export const playerAuthMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const code = c.req.param('code');
  if (!code) {
    return c.json({ ok: false, error: { code: 'MISSING_ROOM', message: 'ไม่พบรหัสห้อง' }, requestId: c.get('requestId') }, 400);
  }

  const adminPassword = c.env.ADMIN_PASSWORD || 'TM-OPERA_O';

  // 1. Check if caller has admin privileges
  const authHeader = c.req.header('Authorization');
  const adminToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : c.req.header('x-admin-token') || '';
  if (adminToken && (await verifyAdminToken(adminToken, adminPassword) || timingSafeEqual(adminToken, adminPassword))) {
    return next();
  }

  // 2. Check player token from header or query param
  const playerToken =
    c.req.header('x-player-token') ||
    c.req.query('token') ||
    '';

  if (!playerToken) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'PLAYER_UNAUTHORIZED',
          message: 'ต้องใช้ Player Token เพื่อควบคุมหน้าจอ (เปิดผ่านหน้า Admin)',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      401
    );
  }

  // Verify against room's player token in settings_json
  const room = await getRoomByCode(c.env.DB, code);
  if (!room) {
    return c.json({ ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้องที่ระบุ' }, requestId: c.get('requestId') }, 404);
  }

  let expectedToken = '';
  try {
    const settings = JSON.parse(room.settings_json || '{}');
    expectedToken = settings.playerToken || '';
  } catch {}

  // Require a configured player token; otherwise deny (prevents bypass when unset)
  if (!expectedToken) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'PLAYER_TOKEN_NOT_CONFIGURED',
          message: 'ยังไม่ได้ตั้งค่า Player Token สำหรับห้องนี้',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      403
    );
  }

  if (timingSafeEqual(playerToken, expectedToken)) {
    return next();
  }

  return c.json(
    {
      ok: false,
      error: {
        code: 'PLAYER_TOKEN_INVALID',
        message: 'Player Token ไม่ถูกต้อง',
      },
      requestId: c.get('requestId') || crypto.randomUUID(),
    },
    403
  );
};
