import { Hono } from 'hono';
import { Env, AppVariables } from '../types';
import { adminAuthMiddleware } from '../middleware/auth';
import {
  advanceQueue,
  removeSongFromQueue,
  clearRoomQueue,
  getRoomById,
  broadcastToRoom,
  getDashboardStats,
  getRoomFullDetails,
  reorderSong,
  updateRoomSettings,
  sendPlayerCommand,
} from '../services/queueService';
import {
  CreateRoomRequest,
  UpdateRoomRequest,
  AdminRoomItem,
  Room,
  ReorderSongRequest,
  PlayerCommandRequest,
  RoomSettings,
} from '@qr-music/shared';
import { signAdminToken, timingSafeEqual, generateSecureRoomCode } from '../services/crypto';

export const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// Helper: parse JSON body safely and return 400 on malformed
async function parseBody(c: any): Promise<{ ok: true; body: any } | { ok: false }> {
  try {
    const body = await c.req.json();
    return { ok: true, body };
  } catch {
    return { ok: false };
  }
}

// 1. Admin login endpoint (Publicly accessible)
//    Issues a signed HMAC token — never returns the raw password.
adminRoutes.post('/login', async (c) => {
  const requestId = c.get('requestId');
  const configuredPassword = c.env.ADMIN_PASSWORD || 'TM-OPERA_O';

  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' },
        requestId,
      },
      400
    );
  }

  const { body } = parsed;

  // Constant-time comparison to prevent timing attacks
  if (!body.password || !timingSafeEqual(body.password, configuredPassword)) {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'รหัสผ่านไม่ถูกต้อง' },
        requestId,
      },
      401
    );
  }

  // Issue signed HMAC token (24h expiry), never return the raw password
  const token = await signAdminToken(configuredPassword, 24);

  return c.json({
    ok: true,
    data: {
      token,
      message: 'เข้าสู่ระบบสำเร็จ',
    },
    requestId,
  });
});

// Protect all following admin routes with adminAuthMiddleware
adminRoutes.use('*', adminAuthMiddleware);

// 2. Dashboard overview: System stats & room summary
adminRoutes.get('/dashboard', async (c) => {
  const requestId = c.get('requestId');
  const stats = await getDashboardStats(c.env.DB);

  const rooms = await c.env.DB
    .prepare('SELECT * FROM rooms ORDER BY created_at DESC')
    .all<Room>();

  const roomItems: AdminRoomItem[] = [];

  for (const room of rooms.results ?? []) {
    const countRes = await c.env.DB
      .prepare("SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND status = 'queued'")
      .bind(room.id)
      .first<{ count: number }>();

    const playing = await c.env.DB
      .prepare("SELECT title, video_id FROM songs WHERE room_id = ? AND status = 'playing' LIMIT 1")
      .bind(room.id)
      .first<{ title: string | null; video_id: string }>();

    const session = await c.env.DB
      .prepare('SELECT status, last_seen_at FROM player_sessions WHERE room_id = ? LIMIT 1')
      .bind(room.id)
      .first<{ status: string; last_seen_at: string }>();

    let isPlayerOnline = false;
    if (session && session.last_seen_at) {
      if (Date.now() - new Date(session.last_seen_at).getTime() < 45000) {
        isPlayerOnline = true;
      }
    }

    roomItems.push({
      ...room,
      queuedCount: countRes?.count ?? 0,
      playingTitle: playing?.title ?? null,
      playingVideoId: playing?.video_id ?? null,
      playerOnline: isPlayerOnline,
      playerStatus: session?.status || 'offline',
    });
  }

  return c.json({
    ok: true,
    data: {
      stats,
      rooms: roomItems,
    },
    requestId,
  });
});

// 3. List all rooms
adminRoutes.get('/rooms', async (c) => {
  const requestId = c.get('requestId');
  const rooms = await c.env.DB
    .prepare('SELECT * FROM rooms ORDER BY created_at DESC')
    .all<Room>();

  const roomItems: AdminRoomItem[] = [];

  for (const room of rooms.results ?? []) {
    const countRes = await c.env.DB
      .prepare("SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND status = 'queued'")
      .bind(room.id)
      .first<{ count: number }>();

    const playing = await c.env.DB
      .prepare("SELECT title, video_id FROM songs WHERE room_id = ? AND status = 'playing' LIMIT 1")
      .bind(room.id)
      .first<{ title: string | null; video_id: string }>();

    const session = await c.env.DB
      .prepare('SELECT status, last_seen_at FROM player_sessions WHERE room_id = ? LIMIT 1')
      .bind(room.id)
      .first<{ status: string; last_seen_at: string }>();

    let isPlayerOnline = false;
    if (session && session.last_seen_at) {
      if (Date.now() - new Date(session.last_seen_at).getTime() < 45000) {
        isPlayerOnline = true;
      }
    }

    roomItems.push({
      ...room,
      queuedCount: countRes?.count ?? 0,
      playingTitle: playing?.title ?? null,
      playingVideoId: playing?.video_id ?? null,
      playerOnline: isPlayerOnline,
      playerStatus: session?.status || 'offline',
    });
  }

  return c.json({
    ok: true,
    data: { rooms: roomItems },
    requestId,
  });
});

// 4. Get full details of a specific room (Control Center detail view)
adminRoutes.get('/rooms/:id/details', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  try {
    const detail = await getRoomFullDetails(c.env.DB, id, c.env.PUBLIC_URL);
    return c.json({
      ok: true,
      data: detail,
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'ROOM_NOT_FOUND', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      404
    );
  }
});

// 5. Create a room
adminRoutes.post('/rooms', async (c) => {
  const requestId = c.get('requestId');
  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, requestId },
      400
    );
  }

  const body = parsed.body;
  if (!body.name || !body.name.trim()) {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_NAME', message: 'กรุณาระบุชื่อห้อง' },
        requestId,
      },
      400
    );
  }

  // Generate a cryptographically secure room code, ensure uniqueness
  let code = generateSecureRoomCode();
  for (let i = 0; i < 10; i++) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM rooms WHERE code = ?')
      .bind(code)
      .first();
    if (!existing) break;
    code = generateSecureRoomCode();
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialSettings: RoomSettings = {
    maxQueue: 100,
    allowDuplicates: false,
    cooldownSeconds: 5,
  };

  await c.env.DB.prepare(`
    INSERT INTO rooms (id, code, name, status, queue_version, settings_json, created_at, updated_at)
    VALUES (?, ?, ?, 'open', 0, ?, ?, ?)
  `).bind(id, code, body.name.trim(), JSON.stringify(initialSettings), now, now).run();

  const newRoom: Room = {
    id,
    code,
    name: body.name.trim(),
    status: 'open',
    queue_version: 0,
    settings_json: JSON.stringify(initialSettings),
    created_at: now,
    updated_at: now,
  };

  return c.json(
    {
      ok: true,
      data: { room: newRoom },
      requestId,
    },
    201
  );
});

// 6. Update room details / status
adminRoutes.patch('/rooms/:id', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, requestId },
      400
    );
  }

  const body = parsed.body;
  const room = await getRoomById(c.env.DB, id);
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

  const name = body.name?.trim() || room.name;
  const validStatuses = ['open', 'closed', 'archived'];
  const status = body.status && validStatuses.includes(body.status) ? body.status : room.status;
  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE rooms
    SET name = ?, status = ?, updated_at = ?
    WHERE id = ?
  `).bind(name, status, now, id).run();

  const updatedRoom = { ...room, name, status, updated_at: now };

  await broadcastToRoom(c.env, room.code, {
    type: 'room.updated',
    roomCode: room.code,
    version: room.queue_version,
    payload: { room: updatedRoom },
  });

  return c.json({
    ok: true,
    data: { room: updatedRoom },
    requestId,
  });
});

// 7. Update room settings (maxQueue, allowDuplicates, cooldownSeconds)
adminRoutes.patch('/rooms/:id/settings', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, requestId },
      400
    );
  }

  try {
    const updatedSettings = await updateRoomSettings(c.env, id, parsed.body);
    return c.json({
      ok: true,
      data: { settings: updatedSettings },
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'SETTINGS_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 8. Rotate room code — generate cryptographically secure code, check uniqueness, broadcast
adminRoutes.post('/rooms/:id/rotate-code', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  const room = await getRoomById(c.env.DB, id);
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

  // Ensure new code doesn't collide with any other room
  let newCode = generateSecureRoomCode();
  for (let i = 0; i < 10; i++) {
    const existing = await c.env.DB
      .prepare('SELECT id FROM rooms WHERE code = ? AND id != ?')
      .bind(newCode, id)
      .first();
    if (!existing) break;
    newCode = generateSecureRoomCode();
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE rooms
    SET code = ?, updated_at = ?
    WHERE id = ?
  `).bind(newCode, now, id).run();

  const updatedRoom = { ...room, code: newCode, updated_at: now };

  // Broadcast code rotation to OLD room's DO so connected players know to reconnect
  // We send the updated room object (which contains the new code) so clients can redirect.
  await broadcastToRoom(c.env, room.code, {
    type: 'room.updated',
    roomCode: room.code,
    version: room.queue_version,
    payload: { room: updatedRoom },
  });

  return c.json({
    ok: true,
    data: { room: updatedRoom },
    requestId,
  });
});

// 9. Reorder song up/down
adminRoutes.post('/rooms/:id/songs/:songId/reorder', async (c) => {
  const id = c.req.param('id');
  const songId = c.req.param('songId');
  const requestId = c.get('requestId');

  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, requestId },
      400
    );
  }

  const body = parsed.body;
  if (!body.direction || (body.direction !== 'up' && body.direction !== 'down')) {
    return c.json(
      {
        ok: false,
        error: { code: 'INVALID_DIRECTION', message: 'กรุณาระบุ direction เป็น up หรือ down' },
        requestId,
      },
      400
    );
  }

  try {
    await reorderSong(c.env, id, songId, body.direction);
    return c.json({
      ok: true,
      data: { success: true },
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'REORDER_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 10. Remote Player Command (pause, play, skip, start)
adminRoutes.post('/rooms/:id/player/command', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  const parsed = await parseBody(c);
  if (!parsed.ok) {
    return c.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'รูปแบบข้อมูลไม่ถูกต้อง' }, requestId },
      400
    );
  }

  const body = parsed.body;
  const room = await getRoomById(c.env.DB, id);
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

  const validCommands = ['pause', 'play', 'skip', 'start'];
  if (!body.command || !validCommands.includes(body.command)) {
    return c.json(
      { ok: false, error: { code: 'INVALID_COMMAND', message: 'คำสั่งไม่ถูกต้อง' }, requestId },
      400
    );
  }

  try {
    if (body.command === 'skip') {
      await advanceQueue(c.env, id, 'skipped');
    } else {
      await sendPlayerCommand(c.env, room.code, body.command);
    }

    return c.json({
      ok: true,
      data: { command: body.command, success: true },
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'COMMAND_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 11. Skip current playing song
adminRoutes.post('/rooms/:id/songs/:songId/skip', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  try {
    const result = await advanceQueue(c.env, id, 'skipped');
    return c.json({
      ok: true,
      data: result,
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'SKIP_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 12. Remove song from queue
adminRoutes.delete('/rooms/:id/songs/:songId', async (c) => {
  const id = c.req.param('id');
  const songId = c.req.param('songId');
  const requestId = c.get('requestId');

  try {
    await removeSongFromQueue(c.env, id, songId);
    return c.json({
      ok: true,
      data: { success: true },
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'REMOVE_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 13. Clear queue
adminRoutes.post('/rooms/:id/queue/clear', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  try {
    await clearRoomQueue(c.env, id);
    return c.json({
      ok: true,
      data: { success: true },
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'CLEAR_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});

// 14. Force next song from admin
adminRoutes.post('/rooms/:id/player/next', async (c) => {
  const id = c.req.param('id');
  const requestId = c.get('requestId');

  try {
    const result = await advanceQueue(c.env, id, 'finished');
    return c.json({
      ok: true,
      data: result,
      requestId,
    });
  } catch (err: unknown) {
    return c.json(
      {
        ok: false,
        error: { code: 'NEXT_ERROR', message: err instanceof Error ? err.message : String(err) },
        requestId,
      },
      400
    );
  }
});
