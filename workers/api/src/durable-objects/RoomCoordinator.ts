import { DurableObject } from 'cloudflare:workers';
import { Env } from '../types';
import { ServerToClientMessage, ClientToServerMessage } from '@qr-music/shared';

export class RoomCoordinator extends DurableObject<Env> {
  private roomCode: string | null = null;

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // 1. WebSocket Upgrade Handler
    if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const roomCode = url.searchParams.get('roomCode') || 'unknown';
      this.roomCode = roomCode;

      // Accept the WebSocket into Durable Object Hibernation
      this.ctx.acceptWebSocket(server, [roomCode]);

      // Return client side of the pair
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
        return new Response(JSON.stringify({ ok: true, recipients: this.ctx.getWebSockets().length }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: unknown) {
        return new Response(
          JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Status check
    if (url.pathname === '/stats') {
      return new Response(
        JSON.stringify({
          activeConnections: this.ctx.getWebSockets().length,
          roomCode: this.roomCode,
        }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Not found', { status: 404 });
  }

  // WebSocket Hibernation: message handler
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return;

    try {
      const data = JSON.parse(message) as ClientToServerMessage;

      if (data.type === 'client.hello') {
        // Acknowledge client connection
        ws.send(
          JSON.stringify({
            type: 'player.status',
            roomCode: this.roomCode || '',
            version: data.lastSeenVersion,
            payload: { status: 'connected', timestamp: new Date().toISOString() },
          })
        );
      }
    } catch {
      // Ignore malformed client messages
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    ws.close(code, 'Durable Object closed connection');
  }

  webSocketError(ws: WebSocket, error: unknown): void {
    ws.close(1011, 'WebSocket error occurred');
  }

  // Broadcast helper to send to all connected clients in this room
  broadcast(message: ServerToClientMessage): void {
    const payload = JSON.stringify(message);
    const sockets = this.ctx.getWebSockets();
    for (const ws of sockets) {
      try {
        ws.send(payload);
      } catch {
        // Socket may have closed, ignore
      }
    }
  }
}
