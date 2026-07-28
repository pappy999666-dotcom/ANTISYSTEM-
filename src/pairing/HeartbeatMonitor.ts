/**
 * PAPPYBOT V2 — Heartbeat Monitor
 *
 * Tracks per-session liveness. Emits health:changed when a session
 * goes stale (no activity beyond the threshold).
 */

import { logger } from '../logger/Logger';
import type { EventBus } from '../events/EventBus';
import { socketManager } from '../whatsapp/SocketManager';

const log = logger.child('HeartbeatMonitor');

export interface HeartbeatRecord {
  sessionId: string;
  lastActivity: number;
  lastPing: number;
  connectionDurationMs: number;
  reconnectCount: number;
  missedHeartbeats: number;
  socketHealthy: boolean;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS = 90_000;

export class HeartbeatMonitor {
  private readonly records = new Map<string, HeartbeatRecord>();
  private readonly connectedAt = new Map<string, number>();
  private timer?: ReturnType<typeof setInterval>;

  constructor(private readonly bus: EventBus) {}

  start(): void {
    this.timer = setInterval(() => this._tick(), HEARTBEAT_INTERVAL_MS);
    log.debug('Heartbeat monitor started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  register(sessionId: string): void {
    this.records.set(sessionId, {
      sessionId,
      lastActivity: Date.now(),
      lastPing: Date.now(),
      connectionDurationMs: 0,
      reconnectCount: 0,
      missedHeartbeats: 0,
      socketHealthy: false,
    });
    this.connectedAt.set(sessionId, Date.now());
  }

  unregister(sessionId: string): void {
    this.records.delete(sessionId);
    this.connectedAt.delete(sessionId);
  }

  touch(sessionId: string): void {
    const r = this.records.get(sessionId);
    if (r) r.lastActivity = Date.now();
  }

  incrementReconnect(sessionId: string): void {
    const r = this.records.get(sessionId);
    if (r) r.reconnectCount++;
  }

  get(sessionId: string): HeartbeatRecord | undefined {
    return this.records.get(sessionId);
  }

  getAll(): HeartbeatRecord[] {
    return [...this.records.values()];
  }

  private _tick(): void {
    const now = Date.now();
    for (const [sessionId, record] of this.records) {
      const socketHealth = socketManager.healthCheck().find(h => h.sessionId === sessionId);
      record.socketHealthy = socketHealth?.connected ?? false;
      record.lastPing = now;

      const connectedSince = this.connectedAt.get(sessionId) ?? now;
      record.connectionDurationMs = now - connectedSince;

      const stale = now - record.lastActivity > STALE_THRESHOLD_MS;
      if (stale) {
        record.missedHeartbeats++;
        log.warn('Session heartbeat stale', { sessionId, missed: record.missedHeartbeats });
        void this.bus.emit('session:health_changed', {
          sessionId,
          healthy: false,
          reason: `No activity for ${Math.round((now - record.lastActivity) / 1000)}s`,
        });
      } else {
        if (record.missedHeartbeats > 0) {
          record.missedHeartbeats = 0;
          void this.bus.emit('session:health_changed', { sessionId, healthy: true, reason: 'Activity resumed' });
        }
      }
    }
  }
}
