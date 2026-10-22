export const YOUTUBE_HOSTS = new Set([
    'www.youtube.com',
    'youtube.com',
    'm.youtube.com',
    'youtu.be',
]);
export const RATE_LIMITS = {
    MAX_REQUESTS_PER_MINUTE: 5,
    MIN_COOLDOWN_SECONDS: 5,
    MAX_QUEUED_SONGS: 100,
    MAX_BODY_BYTES: 8 * 1024, // 8 KB
};
export const ROOM_STATUS = {
    OPEN: 'open',
    CLOSED: 'closed',
    ARCHIVED: 'archived',
};
export const SONG_STATUS = {
    QUEUED: 'queued',
    PLAYING: 'playing',
    PLAYED: 'played',
    SKIPPED: 'skipped',
    REJECTED: 'rejected',
    REMOVED: 'removed',
};
export const YOUTUBE_PLAYER_STATES = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5,
};
