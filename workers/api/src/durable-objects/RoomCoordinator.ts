import { DurableObject } from 'cloudflare:workers';
import { Env } from '../types';
import { ServerToClientMessage, ClientToServerMessage } from '@qr-music/shared';

export class RoomCoordinator extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade Handler
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const roomCode = url.searchParams.get('roomCode') || 'unknown';

      // Accept into hibernation — tag with roomCode so we can retrieve it after wake-up
      this.ctx.acceptWebSocket(server, [roomCode]);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // 2. Internal Broadcast endpoint called by Worker routes
    if (url.pathname === '/broadcast' && request.method === 'POST') {
      try {
        const body = (await request.json()) as ServerToClientMessage;
        this.broadcast(body);
        return new Response(
          JSON.stringify({ ok: true, recipients: this.ctx.getWebSockets().length }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      } catch (err: unknown) {
        return new Response(
          JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Status check — retrieve roomCode safely from first connected WebSocket tag
    if (url.pathname === '/stats') {
      const sockets = this.ctx.getWebSockets();
      const roomCode = sockets.length > 0 ? (this.ctx.getTags(sockets[0])[0] ?? null) : null;
      return new Response(
        JSON.stringify({
          activeConnections: sockets.length,
          roomCode,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }

  // WebSocket Hibernation: message handler
  // NOTE: Instance variables are NOT available after hibernation wakeup.
  // Always retrieve roomCode from ctx.getTags(ws)[0].
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;

    try {
      const data = JSON.parse(message) as ClientToServerMessage;

      if (data.type === 'client.hello') {
        // Retrieve roomCode from tag (safe after hibernation)
        const roomCode = this.ctx.getTags(ws)[0] ?? '';
        ws.send(
          JSON.stringify({
            type: 'player.status',
            roomCode,
            version: data.lastSeenVersion,
            payload: { status: 'connected', timestamp: new Date().toISOString() },
          })
        );
      }
    } catch {
      // Ignore malformed client messages
    }
  }

  webSocketClose(ws: WebSocket, code: number, _reason: string): void {
    // Codes 1005 and 1006 must NOT be sent by application code — they are reserved.
    // Using them in ws.close() throws a runtime error.
    const safeCode = code === 1005 || code === 1006 ? 1000 : code;
    try {
      ws.close(safeCode, 'Connection closed');
    } catch {
      // Socket may already be closed
    }
  }

  webSocketError(ws: WebSocket, _error: unknown): void {
    try {
      ws.close(1011, 'WebSocket error occurred');
    } catch {
      // Socket may already be closed
    }
  }

  // Broadcast helper to send to all connected clients in this room
  broadcast(message: ServerToClientMessage): void {
    const payload = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        // Socket may have closed, ignore
      }
    }
  }
}
