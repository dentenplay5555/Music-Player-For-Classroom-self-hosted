import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env, AppVariables } from './types';
import { rateLimiter } from './middleware/rateLimit';
import { publicRoutes } from './routes/public';
import { adminRoutes } from './routes/admin';

// Export Durable Object class required by Cloudflare Workers runtime
export { RoomCoordinator } from './durable-objects/RoomCoordinator';

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. CORS
app.use(
  '*',
  cors({
    origin: (origin) => origin || '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'x-admin-token', 'Upgrade'],
    exposeHeaders: ['x-request-id'],
    maxAge: 86400,
  })
);

// 2. Request ID & Logging Middleware
app.use('*', async (c, next) => {
  const reqId = c.req.header('x-request-id') || crypto.randomUUID();
  c.set('requestId', reqId);
  c.header('x-request-id', reqId);
  await next();
});

// 3. Rate limiter
app.use('/api/v1/*', rateLimiter);

// 4. Health Check
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

// 5. Mount API Routes
app.route('/api/v1', publicRoutes);
app.route('/api/v1/admin', adminRoutes);

// 6. Global 404 Handler
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

// 7. Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled API Error:', err);
  return c.json(
    {
      ok: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'เกิดข้อผิดพลาดภายในระบบ' },
      requestId: c.get('requestId') || crypto.randomUUID(),
    },
    500
  );
});

export default app;
