import { MiddlewareHandler } from 'hono';
import { Env, AppVariables } from '../types';

export const adminAuthMiddleware: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  const adminPassword = c.env.ADMIN_PASSWORD || 'TM-OPERA_O';

  // Check Authorization header or Cookie or x-admin-token
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

  // Token matches admin password or signed token
  if (!token || token !== adminPassword) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'รหัสผ่านหรือสิทธิ์ Admin ไม่ถูกต้อง',
        },
        requestId: c.get('requestId') || crypto.randomUUID(),
      },
      401
    );
  }

  await next();
};
