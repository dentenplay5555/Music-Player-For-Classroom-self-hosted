export type RoomStatus = 'open' | 'closed' | 'archived';

export type SongStatus =
  | 'queued'
  | 'playing'
  | 'played'
  | 'skipped'
  | 'rejected'
  | 'removed';

export interface RoomSettings {
  maxQueue: number;
  allowDuplicates: boolean;
  cooldownSeconds: number;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  status: RoomStatus;
  queue_version: number;
  settings_json: string;
  created_at: string;
  updated_at: string;
}

export interface Song {
  id: string;
  room_id: string;
  video_id: string;
  title: string | null;
  status: SongStatus;
  position: number;
  request_token_hash?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
}

export interface QueueSnapshot {
  room: Room;
  playing: Song | null;
  queue: Song[];
  queueVersion: number;
  publicUrl?: string;
  playerOnline?: boolean;
  playerStatus?: string;
}

export interface RoomEventItem {
  id: number;
  room_id: string;
  version: number;
  event_type: string;
  payload_json: string;
  created_at: string;
}

export interface ApiResponseSuccess<T> {
  ok: true;
  data: T;
  requestId: string;
}

export interface ApiResponseError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export interface AddSongRequest {
  youtubeUrl: string;
  requestId: string;
}

export interface AddSongResponseData {
  song: Song;
  queueVersion: number;
  position: number;
}

export interface AdminLoginRequest {
  password?: string;
}

export interface CreateRoomRequest {
  name: string;
}

export interface UpdateRoomRequest {
  name?: string;
  status?: RoomStatus;
  settings?: Partial<RoomSettings>;
}

export interface AdminRoomItem extends Room {
  queuedCount: number;
  playingTitle: string | null;
  playingVideoId: string | null;
  playerOnline: boolean;
  playerStatus: string;
}

export interface DashboardStats {
  activeRoomsCount: number;
  totalQueuedSongs: number;
  connectedPlayersCount: number;
  totalRoomsCount: number;
  requestsTodayCount: number;
}

export interface AdminRoomDetail {
  room: Room;
  settings: RoomSettings;
  playing: Song | null;
  queue: Song[];
  history: Song[];
  events: RoomEventItem[];
  playerOnline: boolean;
  playerStatus: string;
  publicUrl?: string;
}

export interface ReorderSongRequest {
  direction: 'up' | 'down';
}

export interface PlayerCommandRequest {
  command: 'pause' | 'play' | 'skip' | 'start';
}
