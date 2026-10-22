-- Migration 0001: Initial schema matching scope.md Section 5.7
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'archived')),
  queue_version INTEGER NOT NULL DEFAULT 0,
  settings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN (
      'queued', 'playing', 'played',
      'skipped', 'rejected', 'removed'
    )),
  position INTEGER NOT NULL,
  request_token_hash TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_songs_queue
  ON songs(room_id, status, position);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_playing_song_per_room
  ON songs(room_id)
  WHERE status = 'playing';

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  auth_subject TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('owner', 'admin')),
  created_at TEXT NOT NULL,
  UNIQUE(room_id, auth_subject)
);

CREATE TABLE IF NOT EXISTS room_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(room_id, version)
);

CREATE TABLE IF NOT EXISTS player_sessions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
