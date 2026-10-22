export declare const YOUTUBE_HOSTS: Set<string>;
export declare const RATE_LIMITS: {
    MAX_REQUESTS_PER_MINUTE: number;
    MIN_COOLDOWN_SECONDS: number;
    MAX_QUEUED_SONGS: number;
    MAX_BODY_BYTES: number;
};
export declare const ROOM_STATUS: {
    readonly OPEN: "open";
    readonly CLOSED: "closed";
    readonly ARCHIVED: "archived";
};
export declare const SONG_STATUS: {
    readonly QUEUED: "queued";
    readonly PLAYING: "playing";
    readonly PLAYED: "played";
    readonly SKIPPED: "skipped";
    readonly REJECTED: "rejected";
    readonly REMOVED: "removed";
};
export declare const YOUTUBE_PLAYER_STATES: {
    readonly UNSTARTED: -1;
    readonly ENDED: 0;
    readonly PLAYING: 1;
    readonly PAUSED: 2;
    readonly BUFFERING: 3;
    readonly CUED: 5;
};
