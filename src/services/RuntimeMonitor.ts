/**
 * PAPPYBOT V2 — Runtime Monitor
 *
 * Tracks operational metrics across all active sessions:
 *   - Active sessions and their statuses
 *   - Per-session uptime
 *   - Reconnect counts
 *   - Memory usage
 *   - Socket health
 *   - Event throughput
 *   - Message throughput
 *   - Cache statistics
 *
 * Data is gathered on demand and emitted as monitor:snapshot events.
 * Future prompts (Telegram panel, Web dashboard) subscribe to those events.
 *
 * Extension points:
 *   - Future prompt: persist snapshots to database for trend graphs.
 *   - Future prompt: emit alerts when thresholds are exceeded.
 */

import type { SocketManager } from '../whatsapp/SocketManager';
import type { SessionManager } from '../managers/SessionManager';
import type { CacheManager } from '../cache/CacheManager';
import type { EventBus } from '../events/EventBus';
import { logger } from '../logger/Logger';

const log = logger.child('RuntimeMonitor');

// ── Types ─────────────────────────────────────────────────────────────────

export interface SessionStats {
  sessionId: string;
  status: string;
  phoneNumber?: string;
  displayName?: string;
  connectedAt?: Date;
  uptimeMs: number;
  reconnectAttempts: number;
  socketConnected: boolean;
  socketLastActivity: number;
}

export interface ThroughputCounters {
  messagesReceived: number;
  messagesSent: number;
  eventsEmitted: number;
  commandsExecuted: number;
  commandErrors: number;
}

export interface RuntimeSnapshot {
  capturedAt: Date;
  sessions: SessionStats[];
  memory: NodeJS.MemoryUsage;
  throughput: ThroughputCounters;
  totalReconnects: number;
  activeSockets: number;
}

// ── Service ───────────────────────────────────────────────────────────────

export class RuntimeMonitor {
  private readonly socketManager: SocketManager;
  private readonly sessionManager: SessionManager;
  private readonly cacheManager: CacheManager;
  private readonly bus: EventBus;

  private readonly startedAt = Date.now();
  private snapshotIntervalMs: number;
  private snapshotTimer?: ReturnType<typeof setInterval>;

  // Throughput counters — reset per snapshot interval or kept as totals
  private counters: ThroughputCounters = {
    messagesReceived: 0,
    messagesSent: 0,
    eventsEmitted: 0,
    commandsExecuted: 0,
    commandErrors: 0,
  };

  private unsubscribers: Array<() => void> = [];

  constructor(
    socketManager: SocketManager,
    sessionManager: SessionManager,
    cacheManager: CacheManager,
    bus: EventBus,
    snapshotIntervalMs = 60_000
  ) {
    this.socketManager = socketManager;
    this.sessionManager = sessionManager;
    this.cacheManager = cacheManager;
    this.bus = bus;
    this.snapshotIntervalMs = snapshotIntervalMs;
  }

  /**
   * Start the monitor: attach event listeners and start the snapshot timer.
   */
  start(): void {
    this.attachListeners();
    this.snapshotTimer = setInterval(() => {
      void this.emitSnapshot();
    }, this.snapshotIntervalMs);
    log.info('Runtime monitor started', { intervalMs: this.snapshotIntervalMs });
  }

  /**
   * Stop the monitor and release listeners.
   */
  stop(): void {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = undefined;
    }
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
    log.info('Runtime monitor stopped');
  }

  // ── Snapshot ──────────────────────────────────────────────────────────

  /**
   * Capture and return a current runtime snapshot.
   */
  snapshot(): RuntimeSnapshot {
    const sessions = this.sessionManager.getAll();
    const socketHealthMap = new Map(
      this.socketManager.healthCheck().map(h => [h.sessionId, h])
    );
    const now = Date.now();

    const sessionStats: SessionStats[] = sessions.map(session => {
      const socketHealth = socketHealthMap.get(session.config.id);
      const connectedAt = session.state.connectedAt;
      const uptimeMs = connectedAt ? now - connectedAt.getTime() : 0;

      return {
        sessionId: session.config.id,
        status: session.state.status,
        phoneNumber: session.state.phoneNumber,
        displayName: session.state.displayName,
        connectedAt,
        uptimeMs,
        reconnectAttempts: session.state.reconnectAttempts,
        socketConnected: socketHealth?.connected ?? false,
        socketLastActivity: socketHealth?.lastActivity ?? 0,
      };
    });

    const totalReconnects = sessionStats.reduce((sum, s) => sum + s.reconnectAttempts, 0);

    return {
      capturedAt: new Date(),
      sessions: sessionStats,
      memory: process.memoryUsage(),
      throughput: { ...this.counters },
      totalReconnects,
      activeSockets: this.socketManager.count(),
    };
  }

  /**
   * Get a formatted summary string (useful for logging / Telegram reports).
   */
  getSummary(): string {
    const snap = this.snapshot();
    const activeSessions = snap.sessions.filter(s => s.status === 'connected').length;
    const memMB = (snap.memory.rss / 1024 / 1024).toFixed(1);
    const uptimeMin = Math.floor((Date.now() - this.startedAt) / 60_000);

    return [
      `📊 Runtime Monitor`,
      `Sessions: ${activeSessions}/${snap.sessions.length} connected`,
      `Memory: ${memMB} MB RSS`,
      `Uptime: ${uptimeMin}m`,
      `Messages: ↓${snap.throughput.messagesReceived} ↑${snap.throughput.messagesSent}`,
      `Commands: ${snap.throughput.commandsExecuted} (${snap.throughput.commandErrors} errors)`,
      `Reconnects: ${snap.totalReconnects}`,
    ].join('\n');
  }

  /**
   * Return memory usage for the current process.
   */
  getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  /**
   * Return uptime in milliseconds since the monitor was created.
   */
  getUptimeMs(): number {
    return Date.now() - this.startedAt;
  }

  /**
   * Current throughput counters (lifetime totals).
   */
  getCounters(): ThroughputCounters {
    return { ...this.counters };
  }

  /**
   * Reset throughput counters (e.g. for per-interval reporting).
   */
  resetCounters(): void {
    this.counters = {
      messagesReceived: 0,
      messagesSent: 0,
      eventsEmitted: 0,
      commandsExecuted: 0,
      commandErrors: 0,
    };
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async emitSnapshot(): Promise<void> {
    try {
      const snap = this.snapshot();
      // Emit a simplified stats payload per session
      for (const session of snap.sessions) {
        await this.bus.emit('monitor:snapshot', {
          sessionId: session.sessionId,
          stats: {
            ...session,
            memory: snap.memory,
            throughput: snap.throughput,
          },
        });
      }
    } catch (err) {
      log.warn('Failed to emit monitor snapshot', { error: String(err) });
    }
  }

  private attachListeners(): void {
    const onMessageReceived = (): void => { this.counters.messagesReceived++; };
    const onMessageSent = (): void => { this.counters.messagesSent++; };
    const onCommandExecuted = (): void => { this.counters.commandsExecuted++; };
    const onCommandError = (): void => { this.counters.commandErrors++; };

    this.bus.on('message:received', onMessageReceived);
    this.bus.on('message:sent', onMessageSent);
    this.bus.on('command:executed', onCommandExecuted);
    this.bus.on('command:error', onCommandError);

    // Register unsubscribers — EventBus.off() if available, else no-op
    const bus = this.bus as { off?: (event: string, fn: unknown) => void };
    if (bus.off) {
      this.unsubscribers.push(
        () => bus.off!('message:received', onMessageReceived),
        () => bus.off!('message:sent', onMessageSent),
        () => bus.off!('command:executed', onCommandExecuted),
        () => bus.off!('command:error', onCommandError),
      );
    }

    log.debug('Runtime monitor listeners attached');
  }
}
