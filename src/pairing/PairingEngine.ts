/**
 * PAPPYBOT V2 — Pairing Engine
 *
 * Orchestrates both pairing methods supported by @crysnovax/baileys:
 *   - QR code pairing
 *   - Pairing code (phone number based)
 *
 * Custom pairing code:
 *   requestPairingCode(phone, customCode) accepts an 8-char custom code.
 *   If PAIRING_CODE env var is set and is exactly 8 chars, it is used.
 *   Otherwise the library generates a random code (default behavior).
 *
 * LIMITATION: WhatsApp does not allow arbitrary custom codes — the code
 * must be exactly 8 characters. Codes shorter or longer are rejected by
 * the library with "Custom pairing code must be exactly 8 chars".
 */

import { logger } from '../logger/Logger';
import type { EventBus } from '../events/EventBus';
import type { SessionManager } from '../managers/SessionManager';
import type { App } from '../core/App';
import { socketManager } from '../whatsapp/SocketManager';
import { sessionMetrics } from './SessionMetrics';
import type { HeartbeatMonitor } from './HeartbeatMonitor';

const log = logger.child('PairingEngine');

export type PairingMethod = 'qr' | 'code';

export type PairingStatus =
  | 'initializing'
  | 'loading_auth'
  | 'connecting'
  | 'waiting_qr'
  | 'waiting_code'
  | 'authenticating'
  | 'loading_groups'
  | 'synchronizing'
  | 'connected'
  | 'ready'
  | 'disconnected'
  | 'reconnecting'
  | 'connection_lost'
  | 'logged_out'
  | 'error';

export interface PairingRequest {
  sessionId: string;
  method: PairingMethod;
  /** Required for pairing code method — E.164 without '+', e.g. "15551234567" */
  phoneNumber?: string;
  /** Optional 8-char custom pairing code. Falls back to random if not provided or invalid. */
  customCode?: string;
  label?: string;
  owner?: string;
}

export interface PairingResult {
  sessionId: string;
  method: PairingMethod;
  /** The pairing code shown to the user (code method only) */
  pairingCode?: string;
  /** QR string (qr method only) — emit via EventBus for rendering */
  qr?: string;
  status: PairingStatus;
}

/** Resolve custom pairing code — must be exactly 8 chars or fall back to undefined */
function resolveCustomCode(raw?: string): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim().toUpperCase();
  if (clean.length === 8) return clean;
  log.warn('Custom pairing code ignored — must be exactly 8 chars', { provided: clean.length });
  return undefined;
}

export class PairingEngine {
  /** Active pairing sessions waiting for QR scan or code entry */
  private readonly pending = new Map<string, PairingRequest>();

  constructor(
    private readonly app: App,
    private readonly sessionManager: SessionManager,
    private readonly heartbeat: HeartbeatMonitor,
    private readonly bus: EventBus
  ) {
    this._listenEvents();
  }

  /**
   * Start a new pairing flow.
   * Creates the session workspace, starts the WhatsApp client,
   * and returns immediately. Live status is delivered via EventBus.
   */
  async pair(req: PairingRequest): Promise<PairingResult> {
    const { sessionId, method, phoneNumber, customCode, label, owner } = req;

    // Validate
    if (method === 'code' && !phoneNumber) {
      throw new Error('phoneNumber is required for pairing code method');
    }
    if (this.sessionManager.get(sessionId)) {
      throw new Error(`Session "${sessionId}" already exists`);
    }

    // Duplicate phone number check
    if (phoneNumber) {
      const duplicate = this.sessionManager.getAll().find(
        s => s.state.phoneNumber && s.state.phoneNumber.replace(/\D/g, '') === phoneNumber.replace(/\D/g, '')
      );
      if (duplicate) {
        throw new Error(`Phone number already paired as session "${duplicate.config.id}"`);
      }
    }

    log.info('Starting pairing', { sessionId, method });
    sessionMetrics.incTotal();
    sessionMetrics.incPairingAttempt();

    await this.bus.emit('session:pair_started', { sessionId, method });

    // Create session workspace
    this.sessionManager.create({
      id: sessionId,
      owner: owner ?? '',
      label: label ?? sessionId,
      settings: {},
    });

    this.pending.set(sessionId, req);
    this.heartbeat.register(sessionId);

    // Emit status: initializing
    this._emitStatus(sessionId, 'initializing');

    // Start the WhatsApp client
    try {
      await this.app.startSession(sessionId);
    } catch (err) {
      this.pending.delete(sessionId);
      sessionMetrics.incFailed();
      const error = err instanceof Error ? err : new Error(String(err));
      await this.bus.emit('session:pair_failed', { sessionId, error: error.message });
      throw err;
    }

    // For pairing code: request the code after socket is created
    if (method === 'code' && phoneNumber) {
      return this._requestCode(sessionId, phoneNumber, customCode);
    }

    return { sessionId, method, status: 'waiting_qr' };
  }

  private async _requestCode(sessionId: string, phoneNumber: string, customCode?: string): Promise<PairingResult> {
    // Wait briefly for socket to be ready
    await this._waitForSocket(sessionId, 5000);

    const sock = socketManager.getSocket(sessionId);
    if (!sock) {
      throw new Error(`Socket not ready for session "${sessionId}"`);
    }

    const resolved = resolveCustomCode(customCode ?? process.env['PAIRING_CODE']);

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const code = await sock.requestPairingCode(phoneNumber.replace(/\D/g, ''), resolved) as string;
      log.info('Pairing code generated', { sessionId, code });
      this._emitStatus(sessionId, 'waiting_code');
      await this.bus.emit('session:pairing_code', { sessionId, code });
      return { sessionId, method: 'code', pairingCode: code, status: 'waiting_code' };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Pairing code request failed', { sessionId, error: error.message });
      await this.bus.emit('session:pair_failed', { sessionId, error: error.message });
      throw err;
    }
  }

  /** Cancel a pending pairing flow */
  cancelPairing(sessionId: string): void {
    this.pending.delete(sessionId);
    log.info('Pairing cancelled', { sessionId });
  }

  isPending(sessionId: string): boolean {
    return this.pending.has(sessionId);
  }

  private _emitStatus(sessionId: string, status: PairingStatus): void {
    void this.bus.emit('session:pairing_status', { sessionId, status });
  }

  private _listenEvents(): void {
    this.bus.on('session:qr', ({ sessionId }) => {
      this._emitStatus(sessionId, 'waiting_qr');
    });

    this.bus.on('session:connected', ({ sessionId }) => {
      this.pending.delete(sessionId);
      sessionMetrics.incPairingSuccess();
      sessionMetrics.incActive();
      this.heartbeat.touch(sessionId);
      this._emitStatus(sessionId, 'connected');
      void this.bus.emit('session:pair_completed', { sessionId });
    });

    this.bus.on('session:disconnected', ({ sessionId }) => {
      this._emitStatus(sessionId, 'disconnected');
    });

    this.bus.on('session:logged_out', ({ sessionId }) => {
      this.pending.delete(sessionId);
      this._emitStatus(sessionId, 'logged_out');
    });

    this.bus.on('session:retry_required', ({ sessionId }) => {
      this._emitStatus(sessionId, 'reconnecting');
      this.heartbeat.incrementReconnect(sessionId);
      sessionMetrics.incReconnect();
    });

    this.bus.on('message:history_set', ({ sessionId }) => {
      this._emitStatus(sessionId, 'synchronizing');
    });

    this.bus.on('auth:updated', ({ sessionId }) => {
      this.heartbeat.touch(sessionId);
    });
  }

  private _waitForSocket(sessionId: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = setInterval(() => {
        if (socketManager.has(sessionId)) {
          clearInterval(check);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(check);
          reject(new Error(`Timeout waiting for socket: ${sessionId}`));
        }
      }, 100);
    });
  }
}
