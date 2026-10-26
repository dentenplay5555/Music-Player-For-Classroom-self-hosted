import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, AppVariables } from './types';
import { songSubmissionRateLimiter, adminLoginRateLimiter } from './middleware/rateLimit';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';

// Export Durable Object class required by Cloudflare Workers runtime
export { RoomCoordinator } from './durable-objects/RoomCoordinator';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. CORS — only allow configured origin or localhost in dev
app.use('*', async (c, next) => {
  const requestOrigin = c.req.header('Origin') || '';
  const publicUrl = c.env.PUBLIC_URL || '';
  const allowedOrigins = [
    publicUrl,
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
  ].filter(Boolean);

  const isLocalhostOrigin = (() => {
    try {
      const u = new URL(requestOrigin);
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    } catch {
      return false;
    }
  })();
  const originAllowed = !requestOrigin ||
    allowedOrigins.some((o) => requestOrigin === o) ||
    isLocalhostOrigin;

  const corsOrigin = originAllowed ? requestOrigin || '*' : allowedOrigins[0] || '*';

  return cors({
    origin: corsOrigin,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'x-admin-token',
      'x-player-token',
      'x-client-id',
      'Upgrade',
    ],
    exposeHeaders: ['x-request-id'],
    maxAge: 86400,
  })(c, next);
});

// 2. Request ID & Logging Middleware
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId', reqId);
  c.header('x-request-id', reqId);
  await next();
});

// 3. Body size guard (8 KB) for mutation endpoints
app.use('*', async (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'PUT' || c.req.method === 'PATCH') {
    const contentLength = Number(c.req.header('content-length') || '0');
    if (contentLength > 8192) {
      return c.json(
        {
          ok: false,
          error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body เกินขนาดที่อนุญาต (8 KB)' },
          requestId: c.get('requestId'),
        },
        413
      );
    }
  }
  await next();
});

// 4. Rate limiters mounted on specific paths
//    - Song submission: POST /api/v1/rooms/:code/songs only
app.use('/api/v1/rooms/*', songSubmissionRateLimiter);
//    - Admin login: POST /api/v1/admin/login only
app.use('/api/v1/admin/login', adminLoginRateLimiter);

// 5. Health Check
app.get('/health', (c) =>
  c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'qr-music-api',
  })
);

app.get('/', (c) =>
  c.json({
    service: 'QR Music Cloudflare API',
    version: '1.0.0',
    documentation: 'See scope.md',
    health: '/health',
  })
);

// 6. Mount API Routes
app.route('/api/v1', publicRoutes);
app.route('/api/v1/admin', adminRoutes);

// 7. Global 404 Handler
app.notFound((c) => {
  return c.json(
    {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'ไม่พบ Endpoint ที่ต้องการ' },
      requestId: c.get('requestId') || crypto.randomUUID(),
    },
    404
  );
});

// 8. Global Error Handler — sanitize error message, never leak internals
app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  return c.json(
    {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'เกิดข้อผิดพลาดภายในระบบ' },
      requestId: c.get('requestId') || crypto.randomUUID(),
    },
    500
  );
});

export default app;
