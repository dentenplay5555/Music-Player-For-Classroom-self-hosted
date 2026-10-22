import { Env } from '../types';
import {
  Room,
  Song,
  QueueSnapshot,
  ServerToClientMessage,
  RoomSettings,
  RoomEventItem,
  DashboardStats,
  AdminRoomDetail,
  RATE_LIMITS,
} from '@qr-music/shared';

export function parseRoomSettings(settingsJson?: string): RoomSettings {
  try {
    if (!settingsJson) {
      return { maxQueue: 100, allowDuplicates: false, cooldownSeconds: 5 };
    }
    const parsed = JSON.parse(settingsJson);
    return {
      maxQueue: typeof parsed.maxQueue === 'number' ? parsed.maxQueue : 100,
      allowDuplicates: Boolean(parsed.allowDuplicates),
      cooldownSeconds: typeof parsed.cooldownSeconds === 'number' ? parsed.cooldownSeconds : 5,
    };
  } catch {
    return { maxQueue: 100, allowDuplicates: false, cooldownSeconds: 5 };
  }
}

// Helper to broadcast event to a room's Durable Object
export async function broadcastToRoom(
  env: Env,
  roomCode: string,
  event: ServerToClientMessage
): Promise<void> {
  try {
    const doId = env.ROOM_COORDINATOR.idFromName(roomCode);
    const stub = env.ROOM_COORDINATOR.get(doId);
    await stub.fetch('http://internal/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch (err) {
    console.error(`Failed to broadcast to room ${roomCode}:`, err);
  }
}

export async function getRoomByCode(db: Env['DB'], code: string): Promise<Room | null> {
  const result = await db
    .prepare('SELECT * FROM rooms WHERE UPPER(code) = UPPER(?)')
    .bind(code)
    .first<Room>();
  return result ?? null;
}

export async function getRoomById(db: Env['DB'], id: string): Promise<Room | null> {
  const result = await db
    .prepare('SELECT * FROM rooms WHERE id = ?')
    .bind(id)
    .first<Room>();
  return result ?? null;
}

export async function getQueueSnapshot(
  db: Env['DB'],
  roomCode: string,
  publicUrl?: string
): Promise<QueueSnapshot | null> {
  const room = await getRoomByCode(db, roomCode);
  if (!room) return null;

  // Get currently playing song
  const playing = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'playing' LIMIT 1")
    .bind(room.id)
    .first<Song>();

  // Get queued songs ordered by position
  const queueResult = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'queued' ORDER BY position ASC")
    .bind(room.id)
    .all<Song>();

  // Check player session online status (within last 45 seconds)
  const session = await db
    .prepare('SELECT status, last_seen_at FROM player_sessions WHERE room_id = ? LIMIT 1')
    .bind(room.id)
    .first<{ status: string; last_seen_at: string }>();

  let isPlayerOnline = false;
  if (session && session.last_seen_at) {
    const diff = Date.now() - new Date(session.last_seen_at).getTime();
    if (diff < 45000) {
      isPlayerOnline = true;
    }
  }

  return {
    room,
    playing: playing ?? null,
    queue: queueResult.results ?? [],
    queueVersion: room.queue_version,
    publicUrl,
    playerOnline: isPlayerOnline,
    playerStatus: session?.status || 'offline',
  };
}

export async function addSongToQueue(
  env: Env,
  roomCode: string,
  videoId: string,
  title: string | null,
  requestId: string
): Promise<{ song: Song; queueVersion: number; position: number }> {
  const db = env.DB;
  const room = await getRoomByCode(db, roomCode);
  if (!room) {
    throw new Error('ROOM_NOT_FOUND: ห้องนี้ไม่มีอยู่ในระบบ');
  }

  if (room.status !== 'open') {
    throw new Error('ROOM_CLOSED: ขณะนี้ห้องปิดรับคำขอเพลงแล้ว');
  }

  const settings = parseRoomSettings(room.settings_json);

  // Check queue length cap from settings
  const countResult = await db
    .prepare("SELECT COUNT(*) as count FROM songs WHERE room_id = ? AND status = 'queued'")
    .bind(room.id)
    .first<{ count: number }>();

  if ((countResult?.count ?? 0) >= settings.maxQueue) {
    throw new Error(`QUEUE_FULL: ขณะนี้คิวเพลงเต็มแล้ว (จำกัดสูงสุด ${settings.maxQueue} เพลง)`);
  }

  // Check duplicate in current queue if disallowed
  if (!settings.allowDuplicates) {
    const duplicate = await db
      .prepare("SELECT id FROM songs WHERE room_id = ? AND video_id = ? AND status = 'queued' LIMIT 1")
      .bind(room.id, videoId)
      .first();

    if (duplicate) {
      throw new Error('DUPLICATE_SONG: เพลงนี้อยู่ในคิวเรียบร้อยแล้ว');
    }
  }

  // Determine next position
  const maxPosResult = await db
    .prepare("SELECT COALESCE(MAX(position), 0) as max_pos FROM songs WHERE room_id = ? AND status = 'queued'")
    .bind(room.id)
    .first<{ max_pos: number }>();
  const nextPosition = (maxPosResult?.max_pos ?? 0) + 1;

  const now = new Date().toISOString();
  const songId = crypto.randomUUID();
  const nextVersion = room.queue_version + 1;

  // Execute in D1 batch (atomic transaction)
  await db.batch([
    // 1. Insert song
    db.prepare(`
      INSERT INTO songs (id, room_id, video_id, title, status, position, request_token_hash, created_at)
      VALUES (?, ?, ?, ?, 'queued', ?, ?, ?)
    `).bind(songId, room.id, videoId, title, nextPosition, requestId, now),

    // 2. Update room version
    db.prepare(`
      UPDATE rooms
      SET queue_version = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextVersion, now, room.id),

    // 3. Log event
    db.prepare(`
      INSERT INTO room_events (room_id, version, event_type, payload_json, created_at)
      VALUES (?, ?, 'song.added', ?, ?)
    `).bind(
      room.id,
      nextVersion,
      JSON.stringify({ songId, videoId, title, position: nextPosition }),
      now
    ),
  ]);

  const newSong: Song = {
    id: songId,
    room_id: room.id,
    video_id: videoId,
    title,
    status: 'queued',
    position: nextPosition,
    request_token_hash: requestId,
    created_at: now,
  };

  // Broadcast to all connected clients
  await broadcastToRoom(env, room.code, {
    type: 'song.added',
    roomCode: room.code,
    version: nextVersion,
    payload: { song: newSong, queueVersion: nextVersion },
  });

  // Also broadcast full queue snapshot
  const snapshot = await getQueueSnapshot(db, room.code);
  if (snapshot) {
    await broadcastToRoom(env, room.code, {
      type: 'queue.updated',
      roomCode: room.code,
      version: nextVersion,
      payload: {
        addedSongId: songId,
        position: nextPosition,
        playing: snapshot.playing,
        queue: snapshot.queue,
      },
    });
  }

  return {
    song: newSong,
    queueVersion: nextVersion,
    position: nextPosition,
  };
}

export async function advanceQueue(
  env: Env,
  roomId: string,
  reason: 'finished' | 'skipped'
): Promise<{ previousSong: Song | null; nextSong: Song | null; queueVersion: number }> {
  const db = env.DB;
  const room = await getRoomById(db, roomId);
  if (!room) {
    throw new Error('ROOM_NOT_FOUND');
  }

  const now = new Date().toISOString();

  // Find currently playing song
  const currentPlaying = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'playing' LIMIT 1")
    .bind(roomId)
    .first<Song>();

  // Find next queued song
  const nextQueued = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'queued' ORDER BY position ASC LIMIT 1")
    .bind(roomId)
    .first<Song>();

  const nextVersion = room.queue_version + 1;
  const statements: D1PreparedStatement[] = [];

  // Update currently playing song if exists
  if (currentPlaying) {
    const statusToSet = reason === 'skipped' ? 'skipped' : 'played';
    statements.push(
      db.prepare(`
        UPDATE songs
        SET status = ?, finished_at = ?
        WHERE id = ?
      `).bind(statusToSet, now, currentPlaying.id)
    );
  }

  // Update next song to playing if exists
  if (nextQueued) {
    statements.push(
      db.prepare(`
        UPDATE songs
        SET status = 'playing', started_at = ?, position = 0
        WHERE id = ?
      `).bind(now, nextQueued.id)
    );
  }

  // Update room version
  statements.push(
    db.prepare(`
      UPDATE rooms
      SET queue_version = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextVersion, now, roomId)
  );

  // Log room event
  const eventType = reason === 'skipped' ? 'song.skipped' : 'song.finished';
  statements.push(
    db.prepare(`
      INSERT INTO room_events (room_id, version, event_type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      roomId,
      nextVersion,
      eventType,
      JSON.stringify({
        previousSongId: currentPlaying?.id ?? null,
        nextSongId: nextQueued?.id ?? null,
      }),
      now
    )
  );

  await db.batch(statements);

  const updatedNextSong: Song | null = nextQueued
    ? { ...nextQueued, status: 'playing', started_at: now, position: 0 }
    : null;

  // Broadcast updates
  if (reason === 'skipped' && currentPlaying) {
    await broadcastToRoom(env, room.code, {
      type: 'song.skipped',
      roomCode: room.code,
      version: nextVersion,
      payload: { songId: currentPlaying.id, queueVersion: nextVersion },
    });
  }

  if (updatedNextSong) {
    await broadcastToRoom(env, room.code, {
      type: 'song.started',
      roomCode: room.code,
      version: nextVersion,
      payload: { song: updatedNextSong, queueVersion: nextVersion },
    });
  }

  const snapshot = await getQueueSnapshot(db, room.code);
  if (snapshot) {
    await broadcastToRoom(env, room.code, {
      type: 'queue.updated',
      roomCode: room.code,
      version: nextVersion,
      payload: {
        playing: snapshot.playing,
        queue: snapshot.queue,
      },
    });
  }

  return {
    previousSong: currentPlaying ?? null,
    nextSong: updatedNextSong,
    queueVersion: nextVersion,
  };
}

export async function reorderSong(
  env: Env,
  roomId: string,
  songId: string,
  direction: 'up' | 'down'
): Promise<void> {
  const db = env.DB;
  const room = await getRoomById(db, roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  // Fetch all queued songs
  const queueResult = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'queued' ORDER BY position ASC")
    .bind(roomId)
    .all<Song>();

  const queue = queueResult.results ?? [];
  const index = queue.findIndex((s) => s.id === songId);
  if (index === -1) throw new Error('SONG_NOT_IN_QUEUE');

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= queue.length) {
    return; // Already at the boundary
  }

  const currentSong = queue[index];
  const adjacentSong = queue[targetIndex];

  const now = new Date().toISOString();
  const nextVersion = room.queue_version + 1;

  // Swap positions atomically
  await db.batch([
    db.prepare('UPDATE songs SET position = ? WHERE id = ?').bind(adjacentSong.position, currentSong.id),
    db.prepare('UPDATE songs SET position = ? WHERE id = ?').bind(currentSong.position, adjacentSong.id),
    db.prepare('UPDATE rooms SET queue_version = ?, updated_at = ? WHERE id = ?').bind(nextVersion, now, roomId),
    db.prepare(`
      INSERT INTO room_events (room_id, version, event_type, payload_json, created_at)
      VALUES (?, ?, 'song.reordered', ?, ?)
    `).bind(
      roomId,
      nextVersion,
      JSON.stringify({
        songId: currentSong.id,
        direction,
        swappedWithSongId: adjacentSong.id,
      }),
      now
    ),
  ]);

  const snapshot = await getQueueSnapshot(db, room.code);
  if (snapshot) {
    await broadcastToRoom(env, room.code, {
      type: 'queue.updated',
      roomCode: room.code,
      version: nextVersion,
      payload: {
        playing: snapshot.playing,
        queue: snapshot.queue,
      },
    });
  }
}

export async function removeSongFromQueue(
  env: Env,
  roomId: string,
  songId: string
): Promise<void> {
  const db = env.DB;
  const room = await getRoomById(db, roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const now = new Date().toISOString();
  const nextVersion = room.queue_version + 1;

  await db.batch([
    db.prepare(`
      UPDATE songs
      SET status = 'removed', finished_at = ?
      WHERE id = ? AND room_id = ?
    `).bind(now, songId, roomId),

    db.prepare(`
      UPDATE rooms
      SET queue_version = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextVersion, now, roomId),

    db.prepare(`
      INSERT INTO room_events (room_id, version, event_type, payload_json, created_at)
      VALUES (?, ?, 'song.removed', ?, ?)
    `).bind(roomId, nextVersion, JSON.stringify({ songId }), now),
  ]);

  const snapshot = await getQueueSnapshot(db, room.code);
  if (snapshot) {
    await broadcastToRoom(env, room.code, {
      type: 'queue.updated',
      roomCode: room.code,
      version: nextVersion,
      payload: {
        playing: snapshot.playing,
        queue: snapshot.queue,
      },
    });
  }
}

export async function clearRoomQueue(env: Env, roomId: string): Promise<void> {
  const db = env.DB;
  const room = await getRoomById(db, roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const now = new Date().toISOString();
  const nextVersion = room.queue_version + 1;

  await db.batch([
    db.prepare(`
      UPDATE songs
      SET status = 'removed', finished_at = ?
      WHERE room_id = ? AND status = 'queued'
    `).bind(now, roomId),

    db.prepare(`
      UPDATE rooms
      SET queue_version = ?, updated_at = ?
      WHERE id = ?
    `).bind(nextVersion, now, roomId),

    db.prepare(`
      INSERT INTO room_events (room_id, version, event_type, payload_json, created_at)
      VALUES (?, ?, 'queue.cleared', '{}', ?)
    `).bind(roomId, nextVersion, now),
  ]);

  const snapshot = await getQueueSnapshot(db, room.code);
  if (snapshot) {
    await broadcastToRoom(env, room.code, {
      type: 'queue.updated',
      roomCode: room.code,
      version: nextVersion,
      payload: {
        playing: snapshot.playing,
        queue: snapshot.queue,
      },
    });
  }
}

export async function updateRoomSettings(
  env: Env,
  roomId: string,
  newSettings: Partial<RoomSettings>
): Promise<RoomSettings> {
  const db = env.DB;
  const room = await getRoomById(db, roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const current = parseRoomSettings(room.settings_json);
  const updated: RoomSettings = {
    ...current,
    ...newSettings,
  };

  const jsonStr = JSON.stringify(updated);
  const now = new Date().toISOString();

  await db.prepare('UPDATE rooms SET settings_json = ?, updated_at = ? WHERE id = ?').bind(jsonStr, now, roomId).run();

  await broadcastToRoom(env, room.code, {
    type: 'room.updated',
    roomCode: room.code,
    version: room.queue_version,
    payload: { room: { ...room, settings_json: jsonStr, updated_at: now } },
  });

  return updated;
}

export async function recordPlayerHeartbeat(
  env: Env,
  roomCode: string,
  status: string
): Promise<void> {
  const db = env.DB;
  const room = await getRoomByCode(db, roomCode);
  if (!room) return;

  const now = new Date().toISOString();
  const sessionId = `session_${room.id}`;

  await db
    .prepare(`
      INSERT INTO player_sessions (id, room_id, status, last_seen_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, last_seen_at = excluded.last_seen_at
    `)
    .bind(sessionId, room.id, status, now)
    .run();

  await broadcastToRoom(env, room.code, {
    type: 'player.status',
    roomCode: room.code,
    version: room.queue_version,
    payload: { status, timestamp: now, online: true },
  });
}

export async function sendPlayerCommand(
  env: Env,
  roomCode: string,
  command: 'pause' | 'play' | 'skip' | 'start'
): Promise<void> {
  const room = await getRoomByCode(env.DB, roomCode);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  await broadcastToRoom(env, room.code, {
    type: 'player.command',
    roomCode: room.code,
    version: room.queue_version,
    payload: { command },
  });
}

export async function getDashboardStats(db: Env['DB']): Promise<DashboardStats> {
  const totalRooms = await db
    .prepare('SELECT COUNT(*) as count FROM rooms')
    .first<{ count: number }>();

  const activeRooms = await db
    .prepare("SELECT COUNT(*) as count FROM rooms WHERE status = 'open'")
    .first<{ count: number }>();

  const queuedSongs = await db
    .prepare("SELECT COUNT(*) as count FROM songs WHERE status = 'queued'")
    .first<{ count: number }>();

  // Count players active within last 45 seconds
  const sessions = await db
    .prepare('SELECT last_seen_at FROM player_sessions')
    .all<{ last_seen_at: string }>();

  let connectedCount = 0;
  const now = Date.now();
  for (const s of sessions.results ?? []) {
    if (s.last_seen_at && now - new Date(s.last_seen_at).getTime() < 45000) {
      connectedCount++;
    }
  }

  // Requests created today
  const todayResult = await db
    .prepare("SELECT COUNT(*) as count FROM songs WHERE date(created_at) = date('now')")
    .first<{ count: number }>();

  return {
    totalRoomsCount: totalRooms?.count ?? 0,
    activeRoomsCount: activeRooms?.count ?? 0,
    totalQueuedSongs: queuedSongs?.count ?? 0,
    connectedPlayersCount: connectedCount,
    requestsTodayCount: todayResult?.count ?? 0,
  };
}

export async function getRoomFullDetails(
  db: Env['DB'],
  roomId: string,
  publicUrl?: string
): Promise<AdminRoomDetail> {
  const room = await getRoomById(db, roomId);
  if (!room) throw new Error('ROOM_NOT_FOUND');

  const settings = parseRoomSettings(room.settings_json);

  const playing = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'playing' LIMIT 1")
    .bind(roomId)
    .first<Song>();

  const queue = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status = 'queued' ORDER BY position ASC")
    .bind(roomId)
    .all<Song>();

  const history = await db
    .prepare("SELECT * FROM songs WHERE room_id = ? AND status IN ('played', 'skipped', 'removed', 'rejected') ORDER BY COALESCE(finished_at, created_at) DESC LIMIT 25")
    .bind(roomId)
    .all<Song>();

  const events = await db
    .prepare('SELECT * FROM room_events WHERE room_id = ? ORDER BY id DESC LIMIT 30')
    .bind(roomId)
    .all<RoomEventItem>();

  const session = await db
    .prepare('SELECT status, last_seen_at FROM player_sessions WHERE room_id = ? LIMIT 1')
    .bind(roomId)
    .first<{ status: string; last_seen_at: string }>();

  let isPlayerOnline = false;
  if (session && session.last_seen_at) {
    if (Date.now() - new Date(session.last_seen_at).getTime() < 45000) {
      isPlayerOnline = true;
    }
  }

  return {
    room,
    settings,
    playing: playing ?? null,
    queue: queue.results ?? [],
    history: history.results ?? [],
    events: events.results ?? [],
    playerOnline: isPlayerOnline,
    playerStatus: session?.status || 'offline',
    publicUrl,
  };
}
