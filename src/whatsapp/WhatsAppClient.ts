/**
 * PAPPYBOT V2 — WhatsApp Client
 *
 * Wraps @crysnovax/baileys to manage a single WhatsApp session connection.
 * Each session gets its own WhatsAppClient instance — sessions are fully isolated.
 *
 * IMPORTANT: @crysnovax/baileys has minimal TypeScript declarations.
 * All Baileys calls go through eslint-disable-next-line comments or
 * `as unknown as X` casts. Never invent unsupported APIs.
 *
 * Responsibilities:
 *  - Establish and maintain the Baileys socket connection
 *  - Handle QR code display and connection events
 *  - Feed raw messages into the MessageNormalizer → MessagePipeline
 *  - Provide the send function to ResponseEngine
 *  - Manage reconnection with back-off
 */

import path from 'path';
import { logger } from '../logger/Logger';
import type { SessionManager } from '../managers/SessionManager';
import type { MessagePipeline } from '../engines/MessagePipeline';
import type { ResponseEngine } from '../engines/ResponseEngine';
import { MessageNormalizer } from './MessageNormalizer';
import type { EventBus } from '../events/EventBus';
import { sleep } from '../utils/helpers';
import { SESSION_RECONNECT_DELAY_MS } from '../constants';

const log = logger.child('WhatsAppClient');

/**
 * One client instance per session.
 * Created and managed by App.startSession().
 */
export class WhatsAppClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private socket: any = null;
  private readonly sessionId: string;
  private readonly sessionManager: SessionManager;
  private readonly pipeline: MessagePipeline;
  private readonly response: ResponseEngine;
  private readonly bus: EventBus;
  private readonly normalizer: MessageNormalizer;
  private readonly storagePath: string;
  private stopping = false;

  constructor(
    sessionId: string,
    sessionManager: SessionManager,
    pipeline: MessagePipeline,
    response: ResponseEngine,
    bus: EventBus,
    prefix: string,
    storagePath: string
  ) {
    this.sessionId = sessionId;
    this.sessionManager = sessionManager;
    this.pipeline = pipeline;
    this.response = response;
    this.bus = bus;
    this.normalizer = new MessageNormalizer(prefix);
    this.storagePath = storagePath;
  }

  /**
   * Initialize and connect the Baileys socket.
   *
   * Uses @crysnovax/baileys — the library has minimal TypeScript declarations.
   * All interactions use the runtime JS API as documented in the library source.
   */
  async start(): Promise<void> {
    this.stopping = false;
    this.sessionManager.updateState(this.sessionId, { status: 'connecting' });

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const baileys = require('@crysnovax/baileys') as Record<string, unknown>;

      const makeWASocket = (baileys['default'] ?? baileys['makeWASocket']) as Function;
      const useMultiFileAuthState = baileys['useMultiFileAuthState'] as Function;
      const DisconnectReason = baileys['DisconnectReason'] as Record<string, number> | undefined;

      if (!makeWASocket || !useMultiFileAuthState) {
        throw new Error(
          'Required @crysnovax/baileys exports (makeWASocket, useMultiFileAuthState) not found. ' +
          'Check the installed version of the library.'
        );
      }

      const authPath = path.join(this.storagePath, this.sessionId);
      const { state, saveCreds } = await useMultiFileAuthState(authPath) as {
        state: unknown;
        saveCreds: () => Promise<void>;
      };

      const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent' },
        getMessage: async () => undefined,
      });

      this.socket = sock;

      // ── Credentials update ─────────────────────────────────────────────
      sock.ev.on('creds.update', saveCreds);

      // ── Connection state ───────────────────────────────────────────────
      sock.ev.on('connection.update', async (update: Record<string, unknown>) => {
        const connection = update['connection'] as string | undefined;
        const lastDisconnect = update['lastDisconnect'] as { error?: { output?: { statusCode?: number } } } | undefined;
        const qr = update['qr'] as string | undefined;

        if (qr) {
          this.sessionManager.updateState(this.sessionId, { status: 'qr_pending' });
          await this.bus.emit('session:qr', { sessionId: this.sessionId, qr });

          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const qrTerminal = require('qrcode-terminal') as { generate: (str: string, opts: object) => void };
            qrTerminal.generate(qr, { small: true });
          } catch {
            log.warn('qrcode-terminal not available, QR code not shown in terminal');
          }
          log.info('QR code generated — scan with WhatsApp', { sessionId: this.sessionId });
        }

        if (connection === 'open') {
          const phoneNumber: string = (sock.user?.id as string) ?? '';
          const displayName: string = (sock.user?.name as string) ?? '';
          this.sessionManager.updateState(this.sessionId, {
            status: 'connected',
            connectedAt: new Date(),
            phoneNumber,
            displayName,
          });
          this.sessionManager.resetReconnectAttempts(this.sessionId);
          await this.bus.emit('session:connected', {
            sessionId: this.sessionId,
            phoneNumber,
          });
          log.info('Session connected', { sessionId: this.sessionId, phoneNumber });
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const loggedOutCode = DisconnectReason?.['loggedOut'];
          const shouldReconnect = loggedOutCode === undefined || statusCode !== loggedOutCode;

          this.sessionManager.updateState(this.sessionId, { status: 'disconnected' });
          await this.bus.emit('session:disconnected', {
            sessionId: this.sessionId,
            reason: `Status ${statusCode ?? 'unknown'}`,
          });

          if (!this.stopping && shouldReconnect) {
            const attempts = this.sessionManager.incrementReconnectAttempts(this.sessionId);
            if (this.sessionManager.hasExceededReconnectLimit(this.sessionId)) {
              log.error('Max reconnect attempts reached', { sessionId: this.sessionId, attempts });
              return;
            }
            log.info('Reconnecting...', { sessionId: this.sessionId, attempt: attempts });
            await sleep(SESSION_RECONNECT_DELAY_MS);
            await this.start();
          } else if (!shouldReconnect) {
            log.warn('Session logged out — delete auth and scan QR again', {
              sessionId: this.sessionId,
            });
          }
        }
      });

      // ── Incoming messages ──────────────────────────────────────────────
      sock.ev.on('messages.upsert', async ({ messages, type }: { messages: unknown[]; type: string }) => {
        if (type !== 'notify') return;
        const session = this.sessionManager.get(this.sessionId);
        if (!session) return;
        const ownerJid = session.state.phoneNumber ?? session.config.owner;

        for (const rawMsg of messages) {
          const normalized = this.normalizer.normalize(rawMsg, this.sessionId, ownerJid);
          if (normalized) {
            await this.pipeline.process(normalized, session);
          }
        }
      });

      // ── Message deletions ──────────────────────────────────────────────
      sock.ev.on('messages.delete', async (item: unknown) => {
        const deletion = item as { keys?: Array<{ id?: string; remoteJid?: string }> };
        for (const key of deletion.keys ?? []) {
          if (key.id && key.remoteJid) {
            await this.bus.emit('message:deleted', {
              messageId: key.id,
              sessionId: this.sessionId,
              chatJid: key.remoteJid,
            });
          }
        }
      });

      // ── Wire up ResponseEngine send function ───────────────────────────
      this.response.setSendFunction(async (sessId, chatJid, payload) => {
        if (sessId !== this.sessionId) return '';
        const result = await sock.sendMessage(chatJid, payload) as Record<string, unknown> | undefined;
        return (result?.['key'] as Record<string, unknown>)?.['id'] as string ?? '';
      });

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.sessionManager.updateState(this.sessionId, { status: 'error', error: error.message });
      await this.bus.emit('session:error', { sessionId: this.sessionId, error });
      log.error('WhatsApp client failed to start', { sessionId: this.sessionId, error: error.message });
      throw err;
    }
  }

  /**
   * Gracefully close this session's connection.
   */
  async stop(): Promise<void> {
    this.stopping = true;
    if (this.socket) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await this.socket.end?.(undefined);
      } catch {
        // Ignore close errors
      }
    }
    this.socket = null;
    this.sessionManager.updateState(this.sessionId, { status: 'disconnected' });
    log.info('WhatsApp client stopped', { sessionId: this.sessionId });
  }

  isConnected(): boolean {
    const state = this.sessionManager.get(this.sessionId)?.state;
    return state?.status === 'connected';
  }
}
