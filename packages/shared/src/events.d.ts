import { Room, Song, QueueSnapshot } from './api-types';
export type WebSocketEventType = 'room.snapshot' | 'queue.updated' | 'song.added' | 'song.started' | 'song.finished' | 'song.skipped' | 'song.removed' | 'room.updated' | 'player.status' | 'resync.required';
export interface BaseServerEvent<T = unknown> {
    type: WebSocketEventType;
    roomCode: string;
    version: number;
    payload: T;
}
export interface RoomSnapshotPayload {
    snapshot: QueueSnapshot;
}
export interface QueueUpdatedPayload {
    addedSongId?: string;
    position?: number;
    playing?: Song | null;
    queue?: Song[];
}
export interface SongEventPayload {
    song: Song;
    queueVersion: number;
}
export interface SongSkippedPayload {
    songId: string;
    queueVersion: number;
}
export interface RoomUpdatedPayload {
    room: Room;
}
export interface PlayerStatusPayload {
    status: string;
    timestamp: string;
}
export interface ResyncRequiredPayload {
    reason: string;
    latestVersion: number;
}
export type ServerToClientMessage = BaseServerEvent<RoomSnapshotPayload> | BaseServerEvent<QueueUpdatedPayload> | BaseServerEvent<SongEventPayload> | BaseServerEvent<SongSkippedPayload> | BaseServerEvent<RoomUpdatedPayload> | BaseServerEvent<PlayerStatusPayload> | BaseServerEvent<ResyncRequiredPayload>;
export type ClientToServerMessage = {
    type: 'client.hello';
    lastSeenVersion: number;
} | {
    type: 'player.ended';
    songId: string;
    playbackSessionId: string;
} | {
    type: 'player.state';
    state: string;
    playbackSessionId: string;
};
