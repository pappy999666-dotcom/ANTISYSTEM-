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

import fs from 'fs';
import path from 'path';
import { logger } from '../logger/Logger';
import type { EventBus } from '../events/EventBus';
import type { SessionManager } from '../managers/SessionManager';
import type { App } from '../core/App';
import { socketManager } from '../whatsapp/SocketManager';
import { sessionMetrics } from './SessionMetrics';
import type { HeartbeatMonitor } from './HeartbeatMonitor';
import { config } from '../config/ConfigManager';

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

    if (method === 'code' && !phoneNumber) {
      throw new Error('phoneNumber is required for pairing code method');
    }
    if (this.sessionManager.get(sessionId)) {
      throw new Error(`Session "${sessionId}" already exists`);
    }

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

    // Create session workspace in SessionManager
    this.sessionManager.create({
      id: sessionId,
      owner: owner ?? phoneNumber ?? '',
      label: label ?? sessionId,
      settings: {},
    });

    this.pending.set(sessionId, req);
    this.heartbeat.register(sessionId);
    this._emitStatus(sessionId, 'initializing');

    if (method === 'code' && phoneNumber) {
      // Waiq-style: self-contained pairing, does NOT go through startSession
      return this._pairWithCode(sessionId, phoneNumber, customCode);
    }

    // QR method — use normal startSession flow
    try {
      await this.app.startSession(sessionId);
    } catch (err) {
      this.pending.delete(sessionId);
      sessionMetrics.incFailed();
      const error = err instanceof Error ? err : new Error(String(err));
      await this.bus.emit('session:pair_failed', { sessionId, error: error.message });
      throw err;
    }

    return { sessionId, method, status: 'waiting_qr' };
  }

  /**
   * Waiq-style self-contained pairing code flow.
   * Creates its own fresh socket, wipes auth dir, requests code with retries,
   * handles 515 restart internally, hands off to WhatsAppClient on connect.
   */
  private async _pairWithCode(sessionId: string, phoneNumber: string, customCode?: string): Promise<PairingResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const baileys = require('@crysnovax/baileys') as Record<string, unknown>;
    const makeWASocket = (baileys['default'] ?? baileys['makeWASocket']) as Function;
    const makeCacheableSignalKeyStore = baileys['makeCacheableSignalKeyStore'] as Function | undefined;
    const fetchLatestBaileysVersion = baileys['fetchLatestBaileysVersion'] as Function | undefined;
    const useMultiFileAuthState = baileys['useMultiFileAuthState'] as Function;

    const storagePath = config.get<string>('sessions.storagePath') ?? 'storage/sessions';
    const authDir = path.resolve(storagePath, sessionId);
    const phone = phoneNumber.replace(/\D/g, '');
    const code8 = customCode?.trim().toUpperCase();
    const pairingCode = code8?.length === 8 ? code8 : undefined;

    // Wipe old auth dir — fresh start (Waiq does this)
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });

    // Build auth state
    const { state, saveCreds: _saveCreds } = await useMultiFileAuthState(authDir) as { state: unknown; saveCreds: () => Promise<void> };
    const { version } = fetchLatestBaileysVersion
      ? await (fetchLatestBaileysVersion as () => Promise<{ version: number[] }>)().catch(() => ({ version: [2, 3000, 1017531287] }))
      : { version: [2, 3000, 1017531287] };

    // Track last save for 515 restart
    let _lastSave = Promise.resolve();
    const saveCreds = (): Promise<void> => { _lastSave = _saveCreds(); return _lastSave; };
    const waitSave = (): Promise<void> => _lastSave;

    const noop = (): void => {};
    const baileysLogger = { level: 'silent', trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child: () => baileysLogger };

    const authState = makeCacheableSignalKeyStore
      ? { creds: (state as Record<string, unknown>)['creds'], keys: makeCacheableSignalKeyStore((state as Record<string, unknown>)['keys'], baileysLogger) }
      : state;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock: any = makeWASocket({
      version,
      auth: authState,
      printQRInTerminal: false,
      logger: baileysLogger,
      getMessage: async () => ({ conversation: '' }),
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 30_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 500,
      maxMsgRetryCount: 3,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      fireInitQueries: true,
      emitOwnEvents: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('creds.update', saveCreds);

    return new Promise<PairingResult>((resolve, reject) => {
      let resolved = false;

      // 5 min abandon timer
      const abandonTimer = setTimeout(() => {
        if (resolved) return;
        log.warn('Pairing abandoned (5min timeout)', { sessionId });
        try { sock.end(undefined); } catch { /* ignore */ }
        fs.rmSync(authDir, { recursive: true, force: true });
        this.pending.delete(sessionId);
        this.sessionManager.remove(sessionId);
      }, 5 * 60_000);

      // 30s to get code from WA servers
      const giveUp = setTimeout(() => {
        if (resolved) return;
        resolved = true;
        clearTimeout(abandonTimer);
        try { sock.end(undefined); } catch { /* ignore */ }
        fs.rmSync(authDir, { recursive: true, force: true });
        this.pending.delete(sessionId);
        this.sessionManager.remove(sessionId);
        reject(new Error('Pairing timed out — WA did not respond within 30s'));
      }, 30_000);

      // Request code after 1.5s (Waiq timing)
      setTimeout(async () => {
        if (resolved) return;
        let code: string | undefined;
        let lastErr: Error | undefined;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            if (attempt > 1) await new Promise(r => setTimeout(r, 2_000 * attempt));
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            const result = await sock.requestPairingCode(phone, pairingCode) as string;
            if (result && typeof result === 'string') { code = result; break; }
          } catch (e) {
            lastErr = e instanceof Error ? e : new Error(String(e));
            const sc = (e as Record<string, unknown>)?.['output'] as Record<string, unknown> | undefined;
            const statusCode = sc?.['statusCode'] as number | undefined;
            log.warn('Pair attempt failed', { sessionId, attempt, error: lastErr.message });
            if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
              if (resolved) return;
              resolved = true;
              clearTimeout(giveUp); clearTimeout(abandonTimer);
              try { sock.end(undefined); } catch { /* ignore */ }
              fs.rmSync(authDir, { recursive: true, force: true });
              this.pending.delete(sessionId);
              this.sessionManager.remove(sessionId);
              reject(lastErr); return;
            }
          }
        }

        if (resolved) return;
        if (!code) {
          resolved = true;
          clearTimeout(giveUp); clearTimeout(abandonTimer);
          try { sock.end(undefined); } catch { /* ignore */ }
          fs.rmSync(authDir, { recursive: true, force: true });
          this.pending.delete(sessionId);
          this.sessionManager.remove(sessionId);
          reject(lastErr ?? new Error('No pairing code returned')); return;
        }

        clearTimeout(giveUp);
        log.info('Pairing code generated', { sessionId, code });
        this._emitStatus(sessionId, 'waiting_code');
        await this.bus.emit('session:pairing_code', { sessionId, code });
        resolve({ sessionId, method: 'code', pairingCode: code, status: 'waiting_code' });
      }, 1_500);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      sock.ev.on('connection.update', async (update: Record<string, unknown>) => {
        const connection = update['connection'] as string | undefined;
        const lastDisconnect = update['lastDisconnect'] as { error?: { output?: { statusCode?: number }; message?: string } } | undefined;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (connection === 'open') {
          clearTimeout(abandonTimer);
          this.pending.delete(sessionId);

          // Register socket and hand off to WhatsAppClient via startSession
          socketManager.setSocket(sessionId, sock);
          this.sessionManager.updateState(sessionId, {
            status: 'connected',
            connectedAt: new Date(),
            phoneNumber: (sock.user?.id as string | undefined) ?? phone,
            displayName: (sock.user?.name as string | undefined) ?? '',
          });
          this.sessionManager.resetReconnectAttempts(sessionId);
          socketManager.touchActivity(sessionId);

          sessionMetrics.incPairingSuccess();
          sessionMetrics.incActive();
          this.heartbeat.touch(sessionId);
          this._emitStatus(sessionId, 'connected');

          await this.bus.emit('session:connected', {
            sessionId,
            phoneNumber: (sock.user?.id as string | undefined) ?? phone,
          });
          await this.bus.emit('session:pair_completed', { sessionId });

          log.info('Paired and connected', { sessionId, phone });

          // Now start a full WhatsAppClient to handle messages going forward
          // Remove the raw socket first so startSession can register properly
          socketManager.removeSocket(sessionId, false);
          try {
            await this.app.startSession(sessionId);
          } catch (err) {
            log.error('Failed to start session after pairing', { sessionId, error: String(err) });
          }
          return;
        }

        if (connection === 'close') {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const DR = (require('@crysnovax/baileys') as Record<string, unknown>)['DisconnectReason'] as Record<string, number> | undefined;
          const isRestart = DR?.['restartRequired'] !== undefined && statusCode === DR['restartRequired'];
          const isLoggedOut = DR?.['loggedOut'] !== undefined && statusCode === DR['loggedOut'];
          const isForbidden = DR?.['forbidden'] !== undefined && statusCode === DR['forbidden'];

          if (isRestart) {
            // 515 — creds saved, reconnect via startSession
            log.info('515 restart after pairing — handing off', { sessionId });
            clearTimeout(abandonTimer);
            this.pending.delete(sessionId);
            waitSave().catch(() => { /* ignore */ }).finally(() => {
              setTimeout(() => {
                this.app.startSession(sessionId).catch(e =>
                  log.error('startSession after 515 failed', { sessionId, error: String(e) })
                );
              }, 500);
            });
            return;
          }

          if (isLoggedOut || isForbidden) {
            clearTimeout(abandonTimer);
            this.pending.delete(sessionId);
            this.sessionManager.remove(sessionId);
            fs.rmSync(authDir, { recursive: true, force: true });
            await this.bus.emit('session:pair_failed', { sessionId, error: `Rejected by WhatsApp (${statusCode})` });
            reject(new Error(`Pairing rejected by WhatsApp (${statusCode})`));
          }
          // Transient close — wait for reconnect
        }
      });
    });
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
