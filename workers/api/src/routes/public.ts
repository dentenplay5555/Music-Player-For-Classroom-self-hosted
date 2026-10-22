import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import {
  getRoomByCode,
  getQueueSnapshot,
  addSongToQueue,
  advanceQueue,
  recordPlayerHeartbeat,
} from '../services/queueService';
import { extractVideoId, fetchYouTubeTitle } from '../services/youtube';
import { AddSongRequest } from '@qr-music/shared';

export const publicRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. Get room info
publicRoutes.get('/rooms/:code', async (c) => {
  const code = c.req.param('code');
  const room = await getRoomByCode(c.env.DB, code);
  const requestId = c.get('requestId');

  if (!room) {
    return c.json(
      {
        ok: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้องที่ระบุ' },
        requestId,
      },
      404
    );
  }

  return c.json({
    ok: true,
    data: {
      room,
      publicUrl: c.env.PUBLIC_URL || undefined,
    },
    requestId,
  });
});

// 2. Get full queue snapshot
publicRoutes.get('/rooms/:code/queue', async (c) => {
  const code = c.req.param('code');
  const requestId = c.get('requestId');
  const snapshot = await getQueueSnapshot(c.env.DB, code, c.env.PUBLIC_URL);

  if (!snapshot) {
    return c.json(
      {
        ok: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้องที่ระบุ' },
        requestId,
      },
      404
    );
  }

  return c.json({
    ok: true,
    data: snapshot,
    requestId,
  });
});

// 3. Post a song to queue
publicRoutes.post('/rooms/:code/songs', async (c) => {
  const code = c.req.param('code');
  const requestId = c.get('requestId');

  let body: AddSongRequest;
  try {
    body = await c.req.json<AddSongRequest>();
  } catch {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' },
        requestId,
      },
      400
    );
  }

  if (!body.youtubeUrl || typeof body.youtubeUrl !== 'string') {
    return c.json(
      {
        ok: false,
        error: { code: 'MISSING_URL', message: 'กรุณาระบุ YouTube URL' },
        requestId,
      },
      400
    );
  }

  const videoId = extractVideoId(body.youtubeUrl);
  if (!videoId) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'INVALID_YOUTUBE_URL',
          message: 'ลิงก์ YouTube ไม่ถูกต้อง กรุณาใช้ URL ของ YouTube เช่น https://youtu.be/... หรือ https://www.youtube.com/watch?v=...',
        },
        requestId,
      },
      422
    );
  }

  // Fetch title asynchronously
  const title = await fetchYouTubeTitle(videoId);

  try {
    const result = await addSongToQueue(
      c.env,
      code,
      videoId,
      title,
      body.requestId || requestId
    );

    return c.json(
      {
        ok: true,
        data: result,
        requestId,
      },
      201
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const [codeStr, ...msgParts] = message.split(': ');
    return c.json(
      {
        ok: false,
        error: {
          code: codeStr || 'QUEUE_ERROR',
          message: msgParts.join(': ') || message,
        },
        requestId,
      },
      400
    );
  }
});

// 4. Query events since version (Recovery)
publicRoutes.get('/rooms/:code/events', async (c) => {
  const code = c.req.param('code');
  const sinceVersion = Number(c.req.query('since') || '0');
  const requestId = c.get('requestId');

  const room = await getRoomByCode(c.env.DB, code);
  if (!room) {
    return c.json(
      {
        ok: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้องที่ระบุ' },
        requestId,
      },
      404
    );
  }

  const events = await c.env.DB
    .prepare('SELECT * FROM room_events WHERE room_id = ? AND version > ? ORDER BY version ASC LIMIT 50')
    .bind(room.id, sinceVersion)
    .all();

  return c.json({
    ok: true,
    data: {
      roomCode: room.code,
      latestVersion: room.queue_version,
      events: events.results ?? [],
    },
    requestId,
  });
});

// 5. Player reports song ended or requests next song
publicRoutes.post('/rooms/:code/player/next', async (c) => {
  const code = c.req.param('code');
  const requestId = c.get('requestId');
  const room = await getRoomByCode(c.env.DB, code);

  if (!room) {
    return c.json(
      {
        ok: false,
        error: { code: 'ROOM_NOT_FOUND', message: 'ไม่พบห้องที่ระบุ' },
        requestId,
      },
      404
    );
  }

  const result = await advanceQueue(c.env, room.id, 'finished');
  return c.json({
    ok: true,
    data: result,
    requestId,
  });
});

// 5.1 Player Heartbeat
publicRoutes.post('/rooms/:code/player/heartbeat', async (c) => {
  const code = c.req.param('code');
  const requestId = c.get('requestId');
  let status = 'idle';
  try {
    const body = await c.req.json<{ status?: string }>();
    if (body.status) status = body.status;
  } catch {
    // ignore
  }

  await recordPlayerHeartbeat(c.env, code, status);
  return c.json({ ok: true, data: { status, success: true }, requestId });
});

// 6. WebSocket Upgrade Route
publicRoutes.get('/rooms/:code/ws', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const room = await getRoomByCode(c.env.DB, code);

  if (!room) {
    return c.text('Room not found', 404);
  }

  // Forward WebSocket connection directly to RoomCoordinator Durable Object
  const doId = c.env.ROOM_COORDINATOR.idFromName(room.code);
  const stub = c.env.ROOM_COORDINATOR.get(doId);

  const url = new URL(c.req.url);
  url.searchParams.set('roomCode', room.code);

  const response = await stub.fetch(url.toString(), c.req.raw as any);
  return response as unknown as Response;
});
