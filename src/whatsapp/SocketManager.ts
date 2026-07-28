/**
 * PAPPYBOT V2 — Socket Manager
 *
 * Centralized registry for all active Baileys socket instances.
 * Prevents duplicate sockets and provides a single lookup point
 * for any service that needs to interact with a live session.
 *
 * Extension points:
 *   - Call setSocket() from WhatsAppClient after makeWASocket()
 *   - Call removeSocket() on disconnect / logout
 *   - Use getSocket() in services (GroupService, SendMessageService, etc.)
 */

import { logger } from '../logger/Logger';

const log = logger.child('SocketManager');

// Baileys socket is untyped — we work with it as `any` throughout.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaileysSocket = any;

export interface SocketHealth {
  sessionId: string;
  connected: boolean;
  readyState?: number;
  /** Epoch ms of last successful activity */
  lastActivity: number;
}

export class SocketManager {
  private readonly sockets = new Map<string, BaileysSocket>();
  private readonly lastActivity = new Map<string, number>();

  /**
   * Register a socket for a session.
   * If a socket already exists for this session, the old one is
   * closed before the new one is stored to prevent duplicates.
   */
  setSocket(sessionId: string, socket: BaileysSocket): void {
    const existing = this.sockets.get(sessionId);
    if (existing && existing !== socket) {
      log.warn('Replacing existing socket', { sessionId });
      this.closeSocket(existing);
    }
    this.sockets.set(sessionId, socket);
    this.lastActivity.set(sessionId, Date.now());
    log.debug('Socket registered', { sessionId });
  }

  /**
   * Retrieve the live socket for a session, or undefined.
   */
  getSocket(sessionId: string): BaileysSocket | undefined {
    return this.sockets.get(sessionId);
  }

  /**
   * Retrieve the socket or throw if not present.
   */
  requireSocket(sessionId: string): BaileysSocket {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error(`SocketManager: no active socket for session "${sessionId}"`);
    }
    return sock;
  }

  /**
   * Remove and optionally close the socket for a session.
   */
  removeSocket(sessionId: string, close = true): void {
    const sock = this.sockets.get(sessionId);
    if (!sock) return;
    if (close) {
      this.closeSocket(sock);
    }
    this.sockets.delete(sessionId);
    this.lastActivity.delete(sessionId);
    log.debug('Socket removed', { sessionId });
  }

  /** Record that a session sent or received data (used for health checks). */
  touchActivity(sessionId: string): void {
    this.lastActivity.set(sessionId, Date.now());
  }

  /** Whether a socket exists for this session. */
  has(sessionId: string): boolean {
    return this.sockets.has(sessionId);
  }

  /** All registered session IDs. */
  getSessionIds(): string[] {
    return [...this.sockets.keys()];
  }

  /** Count of active sockets. */
  count(): number {
    return this.sockets.size;
  }

  /**
   * Health snapshot for every active socket.
   */
  healthCheck(): SocketHealth[] {
    const results: SocketHealth[] = [];
    for (const [sessionId, sock] of this.sockets) {
      let connected = false;
      let readyState: number | undefined;
      try {
        // Baileys exposes ws.readyState (0=CONNECTING 1=OPEN 2=CLOSING 3=CLOSED)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        readyState = sock?.ws?.readyState as number | undefined;
        connected = readyState === 1;
      } catch {
        connected = false;
      }
      results.push({
        sessionId,
        connected,
        readyState,
        lastActivity: this.lastActivity.get(sessionId) ?? 0,
      });
    }
    return results;
  }

  /** Remove all sockets (used on full shutdown). */
  clear(): void {
    for (const [sessionId] of this.sockets) {
      this.removeSocket(sessionId, true);
    }
  }

  // ── Private ────────────────────────────────────────────────────────────

  private closeSocket(sock: BaileysSocket): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      sock?.end?.(undefined);
    } catch (err) {
      log.debug('Socket close error (ignored)', { error: String(err) });
    }
  }
}

/** Singleton used across the application. */
export const socketManager = new SocketManager();
