import {
  ApiResponse,
  QueueSnapshot,
  Room,
  Song,
  AddSongResponseData,
  AdminRoomItem,
  ServerToClientMessage,
} from '@qr-music/shared';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  requestId?: string;
  constructor(code: string, message: string, requestId?: string) {
    super(message);
    this.code = code;
    this.requestId = requestId;
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('qr_music_admin_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = (await res.json()) as ApiResponse<T>;
  if (!json.ok) {
    throw new ApiError(json.error.code, json.error.message, json.requestId);
  }
  return json.data;
}

export const api = {
  // Public
  getRoom: (code: string) => request<{ room: Room; publicUrl?: string }>(`/rooms/${code}`),
  getQueue: (code: string) => request<QueueSnapshot>(`/rooms/${code}/queue`),
  addSong: (code: string, youtubeUrl: string) =>
    request<AddSongResponseData>(`/rooms/${code}/songs`, {
      method: 'POST',
      body: JSON.stringify({ youtubeUrl, requestId: crypto.randomUUID() }),
    }),
  nextSong: (code: string) =>
    request<{ previousSong: Song | null; nextSong: Song | null; queueVersion: number }>(
      `/rooms/${code}/player/next`,
      { method: 'POST' }
    ),
  sendPlayerHeartbeat: (code: string, status: string) =>
    request<{ status: string; success: boolean }>(`/rooms/${code}/player/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  // Admin
  adminLogin: async (password: string) => {
    const data = await request<{ token: string; message: string }>('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    localStorage.setItem('qr_music_admin_token', data.token);
    return data;
  },
  adminLogout: () => {
    localStorage.removeItem('qr_music_admin_token');
  },
  getDashboard: () =>
    request<{ stats: import('@qr-music/shared').DashboardStats; rooms: AdminRoomItem[] }>(
      '/admin/dashboard'
    ),
  getAdminRooms: () => request<{ rooms: AdminRoomItem[] }>('/admin/rooms'),
  getRoomDetails: (id: string) =>
    request<import('@qr-music/shared').AdminRoomDetail>(`/admin/rooms/${id}/details`),
  createRoom: (name: string) =>
    request<{ room: Room }>('/admin/rooms', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  updateRoom: (id: string, updates: { name?: string; status?: 'open' | 'closed' | 'archived' }) =>
    request<{ room: Room }>(`/admin/rooms/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),
  updateRoomSettings: (id: string, settings: Partial<import('@qr-music/shared').RoomSettings>) =>
    request<{ settings: import('@qr-music/shared').RoomSettings }>(`/admin/rooms/${id}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    }),
  rotateRoomCode: (id: string) =>
    request<{ room: Room }>(`/admin/rooms/${id}/rotate-code`, {
      method: 'POST',
    }),
  reorderSong: (roomId: string, songId: string, direction: 'up' | 'down') =>
    request<{ success: boolean }>(`/admin/rooms/${roomId}/songs/${songId}/reorder`, {
      method: 'POST',
      body: JSON.stringify({ direction }),
    }),
  sendPlayerCommand: (roomId: string, command: 'pause' | 'play' | 'skip' | 'start') =>
    request<{ command: string; success: boolean }>(`/admin/rooms/${roomId}/player/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    }),
  skipSong: (roomId: string, songId: string) =>
    request<{ previousSong: Song | null; nextSong: Song | null }>(
      `/admin/rooms/${roomId}/songs/${songId}/skip`,
      { method: 'POST' }
    ),
  removeSong: (roomId: string, songId: string) =>
    request<{ success: boolean }>(`/admin/rooms/${roomId}/songs/${songId}`, {
      method: 'DELETE',
    }),
  clearQueue: (roomId: string) =>
    request<{ success: boolean }>(`/admin/rooms/${roomId}/queue/clear`, {
      method: 'POST',
    }),
  adminNextSong: (roomId: string) =>
    request<{ previousSong: Song | null; nextSong: Song | null }>(
      `/admin/rooms/${roomId}/player/next`,
      { method: 'POST' }
    ),
};

// WebSocket Client with auto-reconnection and exponential backoff
export function connectRoomWebSocket(
  roomCode: string,
  onMessage: (msg: ServerToClientMessage) => void,
  onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected') => void
): () => void {
  let ws: WebSocket | null = null;
  let isClosedManually = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (isClosedManually) return;
    onStatusChange?.('connecting');

    // Protocol: ws:// or wss:// depending on window.location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/rooms/${roomCode}/ws`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        reconnectAttempts = 0;
        onStatusChange?.('connected');
        // Send hello
        ws?.send(JSON.stringify({ type: 'client.hello', lastSeenVersion: 0 }));
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as ServerToClientMessage;
          onMessage(parsed);
        } catch (err) {
          console.warn('Failed to parse WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        onStatusChange?.('disconnected');
        if (!isClosedManually) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 10000);
          reconnectAttempts++;
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws?.close();
      };
    } catch {
      onStatusChange?.('disconnected');
      if (!isClosedManually) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  return () => {
    isClosedManually = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.close();
      ws = null;
    }
  };
}
