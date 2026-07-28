/**
 * PAPPYBOT V2 — Telegram Bot
 *
 * Main entry point for the Telegram Control Panel.
 * Wires all handlers, middleware, and event integrations.
 */

import { Bot, GrammyError, HttpError } from 'grammy';
import { telegramStore } from './core/TelegramStore';
import { authGuard, registrationGate, forceJoinCheck } from './middleware/TelegramMiddleware';
import { registerRegistrationHandlers, handleRegistrationText } from './handlers/RegistrationHandler';
import { registerDashboardHandlers } from './handlers/DashboardHandler';
import { registerSessionHandlers, handleSessionRenameText, handlePairNameText } from './handlers/SessionHandler';
import { registerGroupHandlers } from './handlers/GroupHandler';
import { registerSettingsHandlers, handleSettingsText } from './handlers/SettingsHandler';
import { registerOwnerHandlers, handleOwnerText } from './handlers/OwnerHandler';
import { registerLogsHandlers, pushLogLine } from './handlers/LogsHandler';
import { handleBridgeMessage } from './handlers/BridgeHandler';
import { NotificationService } from './services/NotificationService';
import { BroadcastService } from './services/BroadcastService';
import type { App } from '../core/App';
import type { SessionManager } from '../managers/SessionManager';
import type { RuntimeMonitor } from '../services/RuntimeMonitor';
import type { EventBus } from '../events/EventBus';
import type { GroupCache } from '../whatsapp/GroupCache';
import type { SocketManager } from '../whatsapp/SocketManager';
import { logger } from '../logger/Logger';

const log = logger.child('TelegramBot');

export class TelegramBot {
  private readonly bot: Bot;
  private readonly notificationService: NotificationService;
  private readonly broadcastService: BroadcastService;

  constructor(
    token: string,
    private readonly app: App,
    private readonly sessionManager: SessionManager,
    private readonly monitor: RuntimeMonitor,
    private readonly bus: EventBus,
    private readonly groupCache: GroupCache,
    private readonly socketManager: SocketManager
  ) {
    this.bot = new Bot(token);
    this.notificationService = new NotificationService(this.bot, bus);
    this.broadcastService = new BroadcastService(this.bot);
    this.setup();
  }

  private setup(): void {
    const bot = this.bot;

    // ── Global middleware ─────────────────────────────────────────────────
    bot.use(authGuard);
    bot.use(forceJoinCheck);
    bot.use(registrationGate);

    // ── Register all handler modules ──────────────────────────────────────
    registerRegistrationHandlers(bot, this.monitor);
    registerDashboardHandlers(bot, this.monitor);
    registerSessionHandlers(bot, this.app, this.sessionManager);
    registerGroupHandlers(bot, this.sessionManager, this.groupCache);
    registerSettingsHandlers(bot);
    registerOwnerHandlers(bot, this.sessionManager, this.monitor);
    registerLogsHandlers(bot);

    // ── Unified text message router ───────────────────────────────────────
    bot.on('message', async (ctx, next) => {
      const id = ctx.from?.id;
      if (!id) return;

      const text = ctx.message?.text ?? '';
      const firstName = ctx.from?.first_name ?? '';

      const reply = async (msg: string, opts?: Record<string, unknown>) => {
        await ctx.reply(msg, { parse_mode: 'HTML', ...(opts ?? {}) } as never);
      };

      // 1. Bridge mode — forward to WhatsApp
      if (await handleBridgeMessage(ctx, this.socketManager)) return;

      // 2. Registration flow (unregistered users)
      if (!telegramStore.isRegistered(id)) {
        if (text) await handleRegistrationText(id, text, firstName, reply);
        return;
      }

      // 3. Owner flows
      if (text && await handleOwnerText(id, text, bot, this.broadcastService, reply)) return;

      // 4. Settings flows (domain update, prefix, import)
      if (text && await handleSettingsText(id, text, reply)) return;

      // 5. Session rename
      if (text && await handleSessionRenameText(id, text, this.sessionManager, reply)) return;

      // 6. Pair session name input
      if (text && await handlePairNameText(id, text, this.sessionManager, reply)) return;

      // 7. Registration domain/name steps for registered users re-entering flow
      if (text && await handleRegistrationText(id, text, firstName, reply)) return;

      await next();
    });

    // ── Catch-all for unhandled callbacks ─────────────────────────────────
    bot.on('callback_query', async (ctx) => {
      await ctx.answerCallbackQuery('⚠️ Unknown action').catch(() => void 0);
    });

    // ── Error handler ─────────────────────────────────────────────────────
    bot.catch((err) => {
      const ctx = err.ctx;
      if (err.error instanceof GrammyError) {
        log.error('Telegram API error', { description: err.error.description });
      } else if (err.error instanceof HttpError) {
        log.error('Telegram HTTP error', { error: String(err.error) });
      } else {
        log.error('Telegram bot error', { error: String(err.error) });
      }
    });

    // ── Event bus → log buffer ────────────────────────────────────────────
    this.bus.on('session:connected', (p) => {
      pushLogLine(`[CONNECTED] ${(p as Record<string, unknown>)['sessionId']}`);
    });
    this.bus.on('session:disconnected', (p) => {
      pushLogLine(`[DISCONNECTED] ${(p as Record<string, unknown>)['sessionId']}`);
    });
    this.bus.on('command:executed', (p) => {
      const pp = p as Record<string, unknown>;
      pushLogLine(`[CMD] ${pp['commandName']} by ${pp['senderJid']} (${pp['durationMs']}ms)`);
    });
    this.bus.on('command:error', (p) => {
      const pp = p as Record<string, unknown>;
      pushLogLine(`[ERR] ${pp['commandName']}: ${String((pp['error'] as Error)?.message ?? pp['error'])}`);
    });
    this.bus.on('anti:triggered', (p) => {
      const pp = p as Record<string, unknown>;
      pushLogLine(`[ANTI] ${pp['detectorId']} → ${pp['action']} in ${pp['groupJid']}`);
    });
  }

  async start(): Promise<void> {
    this.notificationService.start();
    log.info('Starting Telegram bot (long polling)...');
    // Start in background — don't await (blocks forever)
    this.bot.start({
      onStart: (info) => log.info('Telegram bot started', { username: info.username }),
    }).catch((err) => log.error('Telegram bot crashed', { error: String(err) }));
  }

  async stop(): Promise<void> {
    this.notificationService.stop();
    await this.bot.stop();
    log.info('Telegram bot stopped');
  }

  getBot(): Bot {
    return this.bot;
  }
}
