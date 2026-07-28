/**
 * PAPPYBOT V2 — WhatsApp Client
 *
 * Integrates all WhatsApp engine subsystems into a single session-scoped instance:
 *   - SocketManager        — socket registry and health
 *   - AuthManager          — credential storage and pairing flows
 *   - MessageNormalizer    — raw → NormalizedMessage conversion
 *   - SendMessageService   — unified outgoing message engine
 *   - MediaEngine          — download/upload/temp media handling
 *   - GroupCache           — per-session group metadata
 *   - ContactCache         — per-session contact names
 *   - RuntimeMonitor       — operational metrics
 *
 * One WhatsAppClient instance is created per session (WhatsApp account).
 * Sessions are fully isolated — no cross-session side effects.
 *
 * Connection lifecycle:
 *   start() → makeWASocket() → auth events → connection.update → open/close/reconnect
 *
 * Extension points:
 *   - Register additional Baileys event handlers in _registerBaileysEvents()
 *   - Inject GroupService / ContactService via setServices() after start()
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
import { socketManager, type BaileysSocket } from './SocketManager';
import { AuthManager } from './AuthManager';
import { GroupCache } from './GroupCache';
import { ContactCache } from './ContactCache';
import { SendMessageService } from './SendMessageService';
import { MediaEngine } from './MediaEngine';
import { normalizeJid } from '../utils/jid';

const log = logger.child('WhatsAppClient');

export class WhatsAppClient {
  // ── Core deps ────────────────────────────────────────────────────────────
  private readonly sessionId: string;
  private readonly sessionManager: SessionManager;
  private readonly pipeline: MessagePipeline;
  private readonly response: ResponseEngine;
  private readonly bus: EventBus;
  private readonly storagePath: string;

  // ── Engine components ─────────────────────────────────────────────────
  private readonly normalizer: MessageNormalizer;
  private readonly authManager: AuthManager;
  readonly groupCache: GroupCache;
  readonly contactCache: ContactCache;
  readonly sendService: SendMessageService;
  readonly mediaEngine: MediaEngine;

  // ── State ─────────────────────────────────────────────────────────────
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
    this.storagePath = storagePath;

    this.normalizer = new MessageNormalizer(prefix);
    this.authManager = new AuthManager(storagePath);
    this.groupCache = new GroupCache();
    this.contactCache = new ContactCache();
    this.sendService = new SendMessageService(socketManager, bus);
    this.mediaEngine = new MediaEngine(
      socketManager,
      bus,
      path.join(storagePath, sessionId, 'media-tmp')
    );
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Initialize and connect the Baileys socket for this session.
   * Handles QR / pairing code generation and sets up all event handlers.
   */
  async start(): Promise<void> {
    this.stopping = false;
    this.sessionManager.updateState(this.sessionId, { status: 'connecting' });

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const baileys = require('@crysnovax/baileys') as Record<string, unknown>;

      const makeWASocket = (baileys['default'] ?? baileys['makeWASocket']) as Function;
      const DisconnectReason = baileys['DisconnectReason'] as Record<string, number> | undefined;

      if (!makeWASocket) {
        throw new Error(
          'makeWASocket not found in @crysnovax/baileys. Check the installed version.'
        );
      }

      // Load or restore auth state
      const { state, saveCreds } = await this.authManager.loadAuthState(this.sessionId);

      const sock: BaileysSocket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: { level: 'silent' },
        getMessage: async () => undefined,
        // Use a supported browser profile if available
        browser: baileys['Browsers']
          ? (baileys['Browsers'] as Record<string, Function>)['ubuntu']?.('Desktop')
          : undefined,
      });

      // Register socket in the global registry (prevents duplicates)
      socketManager.setSocket(this.sessionId, sock);

      // Wire ResponseEngine to use this session's socket
      this.response.setSendFunction(async (sessId, chatJid, payload) => {
        if (sessId !== this.sessionId) return '';
        const activeSock = socketManager.getSocket(this.sessionId);
        if (!activeSock) return '';
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const result = await activeSock.sendMessage(chatJid, payload) as Record<string, unknown> | undefined;
        socketManager.touchActivity(this.sessionId);
        return (result?.['key'] as Record<string, unknown>)?.['id'] as string ?? '';
      });

      // Register all Baileys event handlers
      this._registerBaileysEvents(sock, saveCreds, DisconnectReason);

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.sessionManager.updateState(this.sessionId, { status: 'error', error: error.message });
      await this.bus.emit('session:error', { sessionId: this.sessionId, error });
      log.error('WhatsApp client failed to start', { sessionId: this.sessionId, error: error.message });
      throw err;
    }
  }

  /**
   * Gracefully close this session's connection and release resources.
   */
  async stop(): Promise<void> {
    this.stopping = true;
    socketManager.removeSocket(this.sessionId, true);
    this.authManager.forgetSession(this.sessionId);
    this.groupCache.clear();
    this.contactCache.clear();
    this.mediaEngine.cleanupTempFiles();
    this.sessionManager.updateState(this.sessionId, { status: 'disconnected' });
    log.info('WhatsApp client stopped', { sessionId: this.sessionId });
  }

  /** Request a pairing code for phone-number auth (call after start(), before QR is scanned). */
  async requestPairingCode(phoneNumber: string): Promise<string> {
    const sock = socketManager.requireSocket(this.sessionId);
    const code = await this.authManager.requestPairingCode(sock, phoneNumber);
    await this.bus.emit('session:pairing_code', { sessionId: this.sessionId, code });
    return code;
  }

  isConnected(): boolean {
    const state = this.sessionManager.get(this.sessionId)?.state;
    return state?.status === 'connected';
  }

  // ── Event registration ─────────────────────────────────────────────────

  /**
   * Attach all Baileys event handlers to the socket.
   * Called once per socket creation (from start()).
   *
   * Extension point: add new event handlers here for future features.
   */
  private _registerBaileysEvents(
    sock: BaileysSocket,
    saveCreds: () => Promise<void>,
    DisconnectReason: Record<string, number> | undefined
  ): void {
    // ── Credentials ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('creds.update', async () => {
      await saveCreds();
      await this.bus.emit('auth:updated', { sessionId: this.sessionId });
    });

    // ── Connection state ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('connection.update', async (update: Record<string, unknown>) => {
      await this._handleConnectionUpdate(update, sock, DisconnectReason);
    });

    // ── Incoming messages ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('messages.upsert', async ({ messages, type }: { messages: unknown[]; type: string }) => {
      if (type !== 'notify') return;
      const session = this.sessionManager.get(this.sessionId);
      if (!session) return;
      const ownerJid = session.state.phoneNumber ?? session.config.owner;
      socketManager.touchActivity(this.sessionId);

      for (const rawMsg of messages) {
        const msg = rawMsg as Record<string, unknown>;

        // Update contact cache from push name
        const senderJid = ((msg['key'] as Record<string, unknown>)?.['participant'] as string)
          ?? ((msg['key'] as Record<string, unknown>)?.['remoteJid'] as string);
        const pushName = msg['pushName'] as string | undefined;
        if (senderJid && pushName) {
          this.contactCache.updatePushName(normalizeJid(senderJid), pushName);
        }

        const normalized = this.normalizer.normalize(rawMsg, this.sessionId, ownerJid);
        if (normalized) {
          await this.bus.emit('message:received', { message: normalized });
          await this.pipeline.process(normalized, session);
        }
      }
    });

    // ── Message updates (status: read, delivered, etc.) ───────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('messages.update', async (updates: unknown[]) => {
      for (const update of updates) {
        const u = update as Record<string, unknown>;
        const key = u['key'] as Record<string, unknown> | undefined;
        if (!key) continue;
        await this.bus.emit('message:updated', {
          sessionId: this.sessionId,
          messageId: key['id'] as string ?? '',
          chatJid: key['remoteJid'] as string ?? '',
        });
      }
    });

    // ── Message deletions ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    // ── Reactions ─────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('messages.reaction', async (reactions: unknown[]) => {
      for (const item of reactions) {
        const r = item as Record<string, unknown>;
        const key = r['key'] as Record<string, unknown> | undefined;
        const reaction = r['reaction'] as Record<string, unknown> | undefined;
        if (!key) continue;
        await this.bus.emit('message:reaction', {
          sessionId: this.sessionId,
          messageId: key['id'] as string ?? '',
          senderJid: normalizeJid(key['participant'] as string ?? key['remoteJid'] as string ?? ''),
          reaction: reaction?.['text'] as string ?? '',
        });
      }
    });

    // ── Read receipts ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('message-receipt.update', async (receipts: unknown[]) => {
      for (const item of receipts) {
        const r = item as Record<string, unknown>;
        const key = r['key'] as Record<string, unknown> | undefined;
        if (!key) continue;
        await this.bus.emit('receipt:updated', {
          sessionId: this.sessionId,
          chatJid: key['remoteJid'] as string ?? '',
          messageIds: [key['id'] as string ?? ''],
        });
      }
    });

    // ── Presence updates ──────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('presence.update', async (update: Record<string, unknown>) => {
      const jid = normalizeJid(update['id'] as string ?? '');
      const presences = update['presences'] as Record<string, Record<string, unknown>> | undefined;
      if (!presences) return;
      for (const [participantJid, presenceData] of Object.entries(presences)) {
        await this.bus.emit('presence:updated', {
          sessionId: this.sessionId,
          chatJid: jid,
          jid: normalizeJid(participantJid),
          presence: presenceData['lastKnownPresence'] as string ?? '',
        });
      }
    });

    // ── Contacts upsert ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('contacts.upsert', async (contacts: unknown[]) => {
      const rawContacts = contacts as Array<Record<string, unknown>>;
      this.contactCache.upsertRaw(rawContacts);
      for (const raw of rawContacts) {
        const jid = raw['id'] as string | undefined;
        if (jid) {
          await this.bus.emit('contact:upserted', { sessionId: this.sessionId, jid: normalizeJid(jid) });
        }
      }
    });

    // ── Contacts update ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('contacts.update', async (contacts: unknown[]) => {
      const rawContacts = contacts as Array<Record<string, unknown>>;
      this.contactCache.upsertRaw(rawContacts);
      for (const raw of rawContacts) {
        const jid = raw['id'] as string | undefined;
        if (jid) {
          await this.bus.emit('contact:updated', { sessionId: this.sessionId, jid: normalizeJid(jid) });
        }
      }
    });

    // ── Groups upsert (new groups) ────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('groups.upsert', async (groups: unknown[]) => {
      for (const group of groups) {
        const g = group as Record<string, unknown>;
        const groupJid = normalizeJid(g['id'] as string ?? '');
        await this.bus.emit('group:upserted', { sessionId: this.sessionId, groupJid });
        log.debug('Group upserted', { sessionId: this.sessionId, groupJid });
      }
    });

    // ── Groups update ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('groups.update', async (updates: unknown[]) => {
      for (const update of updates) {
        const u = update as Record<string, unknown>;
        const groupJid = normalizeJid(u['id'] as string ?? '');

        // Patch cache with what we got
        const patch: Record<string, unknown> = {};
        if (u['subject']) patch['subject'] = u['subject'];
        if (u['desc']) patch['description'] = u['desc'];
        if (u['announce'] !== undefined) patch['announce'] = u['announce'];
        if (u['restrict'] !== undefined) patch['restrict'] = u['restrict'];
        if (Object.keys(patch).length) {
          this.groupCache.patch(groupJid, patch);
        }

        await this.bus.emit('group:updated', { sessionId: this.sessionId, groupJid });
      }
    });

    // ── Group participants update ──────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on(
      'group-participants.update',
      async (update: { id: string; participants: string[]; action: string }) => {
        const groupJid = normalizeJid(update.id ?? '');
        const action = update.action ?? '';

        for (const participantJid of update.participants ?? []) {
          const jid = normalizeJid(participantJid);

          if (action === 'add') {
            this.groupCache.addParticipant(groupJid, { jid, isAdmin: false, isSuperAdmin: false });
            await this.bus.emit('group:participant_added', { sessionId: this.sessionId, groupJid, jid });
          } else if (action === 'remove') {
            this.groupCache.removeParticipant(groupJid, jid);
            await this.bus.emit('group:participant_removed', { sessionId: this.sessionId, groupJid, jid });
          } else if (action === 'promote') {
            this.groupCache.promoteParticipant(groupJid, jid);
            await this.bus.emit('group:participant_promoted', { sessionId: this.sessionId, groupJid, jid });
          } else if (action === 'demote') {
            this.groupCache.demoteParticipant(groupJid, jid);
            await this.bus.emit('group:participant_demoted', { sessionId: this.sessionId, groupJid, jid });
          }
        }

        log.debug('Group participants updated', { sessionId: this.sessionId, groupJid, action });
      }
    );

    // ── Block list updates ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('blocklist.update', async (update: Record<string, unknown>) => {
      const added = (update['added'] as string[] | undefined)?.map(normalizeJid) ?? [];
      const removed = (update['removed'] as string[] | undefined)?.map(normalizeJid) ?? [];
      await this.bus.emit('blocklist:updated', { sessionId: this.sessionId, added, removed });
    });

    // ── Incoming calls ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('call', async (calls: unknown[]) => {
      for (const call of calls) {
        const c = call as Record<string, unknown>;
        const callId = c['id'] as string ?? '';
        const callerJid = normalizeJid(c['from'] as string ?? '');
        const status = c['status'] as string | undefined;

        if (status === 'offer') {
          await this.bus.emit('call:incoming', { sessionId: this.sessionId, callId, callerJid });
          log.debug('Incoming call', { sessionId: this.sessionId, callId, callerJid });
        } else if (status === 'reject' || status === 'timeout') {
          await this.bus.emit('call:rejected', { sessionId: this.sessionId, callId });
        } else if (status === 'accept' || status === 'terminate') {
          await this.bus.emit('call:ended', { sessionId: this.sessionId, callId });
        }
      }
    });

    // ── App state sync ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('app_state.sync.complete', async (names: unknown) => {
      const nameList = Array.isArray(names) ? names as string[] : [String(names)];
      for (const name of nameList) {
        await this.bus.emit('app_state:sync', { sessionId: this.sessionId, name });
      }
    });

    // ── Chats update ──────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    sock.ev.on('chats.update', async (chats: unknown[]) => {
      const jids = (chats as Array<Record<string, unknown>>)
        .map(c => c['id'] as string | undefined)
        .filter((id): id is string => !!id)
        .map(normalizeJid);
      if (jids.length) {
        await this.bus.emit('chats:updated', { sessionId: this.sessionId, chatJids: jids });
      }
    });
  }

  // ── Connection lifecycle ───────────────────────────────────────────────

  private async _handleConnectionUpdate(
    update: Record<string, unknown>,
    sock: BaileysSocket,
    DisconnectReason: Record<string, number> | undefined
  ): Promise<void> {
    const connection = update['connection'] as string | undefined;
    const lastDisconnect = update['lastDisconnect'] as {
      error?: { output?: { statusCode?: number }; message?: string };
    } | undefined;
    const qr = update['qr'] as string | undefined;
    const isNewLogin = update['isNewLogin'] as boolean | undefined;

    // ── QR code ──────────────────────────────────────────────────────────
    if (qr) {
      this.sessionManager.updateState(this.sessionId, { status: 'qr_pending' });
      await this.bus.emit('session:qr', { sessionId: this.sessionId, qr });

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const qrTerminal = require('qrcode-terminal') as { generate: (s: string, o: object) => void };
        qrTerminal.generate(qr, { small: true });
      } catch {
        // qrcode-terminal unavailable — QR is still emitted on the bus
      }

      log.info('QR code generated — scan with WhatsApp', { sessionId: this.sessionId });
    }

    // ── Connection open ───────────────────────────────────────────────────
    if (connection === 'open') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const phoneNumber: string = (sock.user?.id as string) ?? '';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const displayName: string = (sock.user?.name as string) ?? '';

      this.sessionManager.updateState(this.sessionId, {
        status: 'connected',
        connectedAt: new Date(),
        phoneNumber: normalizeJid(phoneNumber),
        displayName,
      });
      this.sessionManager.resetReconnectAttempts(this.sessionId);
      socketManager.touchActivity(this.sessionId);

      await this.bus.emit('session:connected', {
        sessionId: this.sessionId,
        phoneNumber: normalizeJid(phoneNumber),
      });

      if (isNewLogin) {
        log.info('New session paired and connected', { sessionId: this.sessionId, phoneNumber });
      } else {
        log.info('Session connected (restored)', { sessionId: this.sessionId, phoneNumber });
      }
    }

    // ── Connection closed ─────────────────────────────────────────────────
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOutCode = DisconnectReason?.['loggedOut'];
      const streamReplacedCode = DisconnectReason?.['connectionReplaced'];
      const restartRequired = DisconnectReason?.['restartRequired'];

      const isLoggedOut = loggedOutCode !== undefined && statusCode === loggedOutCode;
      const isStreamReplaced = streamReplacedCode !== undefined && statusCode === streamReplacedCode;

      this.sessionManager.updateState(this.sessionId, { status: 'disconnected' });
      await this.bus.emit('session:disconnected', {
        sessionId: this.sessionId,
        reason: lastDisconnect?.error?.message ?? `Status ${statusCode ?? 'unknown'}`,
      });

      if (isLoggedOut) {
        // Permanent logout — clear auth so user can pair again
        log.warn('Session permanently logged out — auth cleared', { sessionId: this.sessionId });
        this.authManager.clearAuthFiles(this.sessionId);
        await this.bus.emit('session:logged_out', { sessionId: this.sessionId });
        return;
      }

      if (isStreamReplaced) {
        log.warn('Stream replaced (another device connected)', { sessionId: this.sessionId });
        await this.bus.emit('session:stream_replaced', { sessionId: this.sessionId });
        return;
      }

      // Reconnect with back-off for transient disconnections
      if (!this.stopping) {
        if (
          restartRequired !== undefined &&
          statusCode === restartRequired
        ) {
          log.info('Reconnecting (restart required)', { sessionId: this.sessionId });
        }

        const attempts = this.sessionManager.incrementReconnectAttempts(this.sessionId);
        if (this.sessionManager.hasExceededReconnectLimit(this.sessionId)) {
          log.error('Max reconnect attempts reached — giving up', {
            sessionId: this.sessionId,
            attempts,
          });
          return;
        }

        const backoffMs = Math.min(SESSION_RECONNECT_DELAY_MS * attempts, 60_000);
        log.info('Reconnecting...', { sessionId: this.sessionId, attempt: attempts, backoffMs });
        this.sessionManager.updateState(this.sessionId, { status: 'connecting' });
        await this.bus.emit('session:reconnected', { sessionId: this.sessionId, attempt: attempts });

        await sleep(backoffMs);
        socketManager.removeSocket(this.sessionId, false); // socket already dead
        await this.start();
      }
    }
  }
}
