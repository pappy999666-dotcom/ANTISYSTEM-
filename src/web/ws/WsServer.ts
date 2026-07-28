/**
 * PAPPYBOT V2 — WebSocket Server
 *
 * Bridges internal EventBus events to connected browser clients.
 * Each client authenticates via JWT on connect.
 * Clients only receive events relevant to their own sessions.
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { verifyToken } from '../middleware/auth';
import type { EventBus } from '../../events/EventBus';
import type { RuntimeMonitor } from '../../services/RuntimeMonitor';
import type { WsMessage, WsEventType } from '../types/Web';
import { logger } from '../../logger/Logger';

const log = logger.child('WebSocketServer');

interface AuthedClient {
  ws: WebSocket;
  userId: string;
  isOwner: boolean;
}

export class WsServer {
  private readonly wss: WebSocketServer;
  private readonly clients = new Set<AuthedClient>();
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    server: Server,
    private readonly bus: EventBus,
    private readonly monitor: RuntimeMonitor
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setup();
    this.attachBusListeners();
  }

  private setup(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Extract token from query string: /ws?token=xxx
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token');
      const decoded = token ? verifyToken(token) : null;

      if (!decoded) {
        ws.close(4001, 'Unauthorized');
        return;
      }

      const client: AuthedClient = { ws, userId: decoded.userId, isOwner: decoded.isOwner };
      this.clients.add(client);
      log.debug('WS client connected', { userId: decoded.userId });

      // Send initial snapshot
      const snap = this.monitor.snapshot();
      this.sendTo(client, 'runtime:snapshot', snap);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as { type: string };
          if (msg.type === 'ping') this.sendTo(client, 'ping', { ts: Date.now() });
        } catch { /* ignore malformed */ }
      });

      ws.on('close', () => {
        this.clients.delete(client);
        log.debug('WS client disconnected', { userId: decoded.userId });
      });

      ws.on('error', (err) => {
        log.warn('WS client error', { userId: decoded.userId, error: String(err) });
        this.clients.delete(client);
      });
    });
  }

  private attachBusListeners(): void {
    const forward = (type: WsEventType) => {
      const id = this.bus.on(type as never, (payload: unknown) => {
        this.broadcast(type, payload);
      });
      this.unsubscribers.push(() => this.bus.off(id));
    };

    forward('session:connected');
    forward('session:disconnected');
    forward('session:state_changed');
    forward('session:qr');
    forward('session:pairing_code');
    forward('session:pairing_status');
    forward('session:pair_completed');
    forward('session:pair_failed');
    forward('session:reconnect_started');
    forward('session:reconnect_completed');
    forward('session:reconnect_failed');
    forward('session:health_changed');
    forward('group:updated');
    forward('monitor:snapshot');
    forward('anti:triggered');
    forward('anti:warn_added');
    forward('group:created');
  }

  broadcast(type: WsEventType, payload: unknown, ownerOnly = false): void {
    const msg: WsMessage = { type, payload, ts: Date.now() };
    const raw = JSON.stringify(msg);
    for (const client of this.clients) {
      if (ownerOnly && !client.isOwner) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  broadcastLog(line: string): void {
    this.broadcast('log:line', { line, ts: Date.now() });
  }

  broadcastNotification(userId: string, message: string): void {
    const msg: WsMessage = { type: 'notification', payload: { message }, ts: Date.now() };
    const raw = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  private sendTo(client: AuthedClient, type: WsEventType, payload: unknown): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({ type, payload, ts: Date.now() } as WsMessage));
    }
  }

  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.wss.close();
  }

  clientCount(): number {
    return this.clients.size;
  }
}
