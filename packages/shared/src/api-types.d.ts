export type RoomStatus = 'open' | 'closed' | 'archived';
export type SongStatus = 'queued' | 'playing' | 'played' | 'skipped' | 'rejected' | 'removed';
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
    settings?: Record<string, unknown>;
}
export interface AdminRoomItem extends Room {
    queuedCount: number;
    playingTitle: string | null;
    playingVideoId: string | null;
}
