/**
 * PAPPYBOT V2 — Connection Manager
 *
 * Dedicated manager for WhatsApp connection lifecycle per session.
 * Responsibilities:
 *   - Track connection state transitions
 *   - Manage reconnect queue with exponential backoff
 *   - Validate session health before reconnect
 *   - Prevent zombie reconnects for intentionally logged-out sessions
 *   - Emit structured events for every state change
 *
 * Connection states handled:
 *   connecting → connected → disconnected → reconnecting → connected
 *   connecting → qr_pending → connected
 *   connected → logged_out (permanent — no reconnect)
 *   connected → stream_replaced (no reconnect)
 *   connected → error (reconnect with backoff)
 *   reconnecting → max_retries_exceeded (give up)
 */

import { logger } from '../logger/Logger';
import type { EventBus } from '../events/EventBus';
import type { SessionManager } from '../managers/SessionManager';
import type { App } from '../core/App';
import { SESSION_MAX_RECONNECT_ATTEMPTS, SESSION_RECONNECT_DELAY_MS } from '../constants';
import { sleep } from '../utils/helpers';
import { sessionMetrics } from './SessionMetrics';
import type { HeartbeatMonitor } from './HeartbeatMonitor';

const log = logger.child('ConnectionManager');

/** Jitter factor: ±10% on backoff delay */
const JITTER = 0.1;

/** Sessions that have been intentionally stopped — no reconnect */
const intentionalStops = new Set<string>();

/** Sessions currently in a reconnect loop — prevent duplicate loops */
const reconnecting = new Set<string>();

function backoffMs(attempt: number): number {
  const base = Math.min(SESSION_RECONNECT_DELAY_MS * Math.pow(2, attempt - 1), 60_000);
  const jitter = base * JITTER * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
}

export class ConnectionManager {
  private readonly disconnectTimes = new Map<string, number>();

  constructor(
    private readonly app: App,
    private readonly sessionManager: SessionManager,
    private readonly heartbeat: HeartbeatMonitor,
    private readonly bus: EventBus
  ) {
    this._listenEvents();
  }

  /**
   * Mark a session as intentionally stopped.
   * Prevents the reconnect engine from restarting it.
   */
  markIntentionalStop(sessionId: string): void {
    intentionalStops.add(sessionId);
    reconnecting.delete(sessionId);
  }

  /**
   * Clear the intentional stop flag (e.g. when user manually reconnects).
   */
  clearIntentionalStop(sessionId: string): void {
    intentionalStops.delete(sessionId);
  }

  isIntentionallyStopped(sessionId: string): boolean {
    return intentionalStops.has(sessionId);
  }

  /**
   * Manually trigger a reconnect for a session.
   * Resets reconnect counter and clears intentional stop.
   */
  async reconnect(sessionId: string): Promise<void> {
    this.clearIntentionalStop(sessionId);
    this.sessionManager.resetReconnectAttempts(sessionId);
    log.info('Manual reconnect triggered', { sessionId });
    await this._doReconnect(sessionId, 1);
  }

  private _listenEvents(): void {
    this.bus.on('session:disconnected', ({ sessionId, reason }) => {
      this.disconnectTimes.set(sessionId, Date.now());
      log.info('Session disconnected', { sessionId, reason });
    });

    this.bus.on('session:connected', ({ sessionId }) => {
      const disconnectedAt = this.disconnectTimes.get(sessionId);
      if (disconnectedAt) {
        const recoveryMs = Date.now() - disconnectedAt;
        sessionMetrics.recordRecoveryTime(recoveryMs);
        this.disconnectTimes.delete(sessionId);
      }
      reconnecting.delete(sessionId);
      log.info('Session connected', { sessionId });
    });

    this.bus.on('session:logged_out', ({ sessionId }) => {
      intentionalStops.add(sessionId);
      reconnecting.delete(sessionId);
      sessionMetrics.decActive();
      log.warn('Session logged out — reconnect disabled', { sessionId });
    });

    this.bus.on('session:stream_replaced', ({ sessionId }) => {
      intentionalStops.add(sessionId);
      reconnecting.delete(sessionId);
      log.warn('Session stream replaced — reconnect disabled', { sessionId });
    });

    this.bus.on('session:retry_required', ({ sessionId, attempt, backoffMs: delay, reason }) => {
      if (intentionalStops.has(sessionId)) return;
      if (reconnecting.has(sessionId)) return;

      reconnecting.add(sessionId);
      void this._doReconnect(sessionId, attempt, delay, reason);
    });
  }

  private async _doReconnect(sessionId: string, attempt: number, delayMs?: number, reason?: string): Promise<void> {
    if (intentionalStops.has(sessionId)) {
      log.debug('Reconnect skipped — intentional stop', { sessionId });
      reconnecting.delete(sessionId);
      return;
    }

    const session = this.sessionManager.get(sessionId);
    if (!session) {
      log.debug('Reconnect skipped — session not found', { sessionId });
      reconnecting.delete(sessionId);
      return;
    }

    if (attempt > SESSION_MAX_RECONNECT_ATTEMPTS) {
      log.error('Max reconnect attempts exceeded', { sessionId, attempt });
      this.sessionManager.updateState(sessionId, { status: 'error', error: 'Max reconnect attempts exceeded' });
      sessionMetrics.incFailed();
      await this.bus.emit('session:reconnect_failed', { sessionId, attempts: attempt });
      reconnecting.delete(sessionId);
      return;
    }

    const delay = delayMs ?? backoffMs(attempt);
    log.info('Reconnecting...', { sessionId, attempt, delayMs: delay, reason });
    this.sessionManager.updateState(sessionId, { status: 'reconnecting' });
    sessionMetrics.incReconnect();
    this.heartbeat.incrementReconnect(sessionId);

    await this.bus.emit('session:reconnect_started', { sessionId, attempt, delayMs: delay });
    await sleep(delay);

    if (intentionalStops.has(sessionId)) {
      reconnecting.delete(sessionId);
      return;
    }

    try {
      await this.app.startSession(sessionId);
      await this.bus.emit('session:reconnect_completed', { sessionId, attempt });
      log.info('Reconnect successful', { sessionId, attempt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Reconnect attempt failed', { sessionId, attempt, error: error.message });
      reconnecting.delete(sessionId);
      // The next retry_required event from WhatsAppClient will trigger another attempt
    }

    reconnecting.delete(sessionId);
  }
}
