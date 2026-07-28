/**
 * PAPPYBOT V2 — Application Core
 *
 * The App class wires together all subsystems and exposes
 * the top-level start/stop lifecycle.
 *
 * Dependency graph:
 *   Logger → Config → EventBus → Cache → DB
 *     → Permissions → Sessions → Middleware
 *     → Commands → Pipeline → Scheduler → Plugins
 *     → GroupService → ContactService → ProfileService → RuntimeMonitor
 *     → WhatsAppClients
 */

import { logger } from '../logger/Logger';
import { config } from '../config/ConfigManager';
import { eventBus } from '../events/EventBus';
import { CacheManager } from '../cache/CacheManager';
import { DatabaseManager } from '../database/DatabaseManager';
import { SessionManager } from '../managers/SessionManager';
import { PermissionManager } from '../permissions/PermissionManager';
import { MiddlewareEngine } from '../middlewares/MiddlewareEngine';
import { CommandEngine } from '../engines/CommandEngine';
import { MessagePipeline } from '../engines/MessagePipeline';
import { ResponseEngine } from '../engines/ResponseEngine';
import { SchedulerService } from '../schedulers/SchedulerService';
import { PluginManager } from '../plugins/PluginManager';
import { ListenerManager } from '../listeners/ListenerManager';
import { WhatsAppClient } from '../whatsapp/WhatsAppClient';
import { container } from './Container';
import { LoggingMiddleware } from '../middlewares/built-in/LoggingMiddleware';
import { MaintenanceMiddleware } from '../middlewares/built-in/MaintenanceMiddleware';
import { RateLimitMiddleware } from '../middlewares/built-in/RateLimitMiddleware';
import { GroupService } from '../services/GroupService';
import { ContactService } from '../services/ContactService';
import { ProfileService } from '../services/ProfileService';
import { RuntimeMonitor } from '../services/RuntimeMonitor';
import { socketManager } from '../whatsapp/SocketManager';
import { GroupCache } from '../whatsapp/GroupCache';
import { ContactCache } from '../whatsapp/ContactCache';
import { AntiEngine } from '../anti/core/AntiEngine';
import { AntiMiddleware } from '../anti/core/AntiMiddleware';
import { GroupManagementPlugin } from '../group/plugin/GroupManagementPlugin';
import { GStatusPlugin } from '../gstatus/plugin/GStatusPlugin';
import { AIPlugin } from '../ai/plugin/AIPlugin';
import { TelegramBot } from '../telegram/TelegramBot';
import { WebServer } from '../web/WebServer';
import { PairingEngine } from '../pairing/PairingEngine';
import { ConnectionManager } from '../pairing/ConnectionManager';
import { HeartbeatMonitor } from '../pairing/HeartbeatMonitor';
import { SessionHealthService } from '../pairing/SessionHealthService';
import { CleanupEngine } from '../pairing/CleanupEngine';
import type { DatabaseConfig } from '../types/Database';

const log = logger.child('App');

export class App {
  private readonly clients = new Map<string, WhatsAppClient>();
  private isRunning = false;
  private monitor?: RuntimeMonitor;
  private telegramBot?: TelegramBot;
  private webServer?: WebServer;
  private heartbeat?: HeartbeatMonitor;
  private connectionManager?: ConnectionManager;
  pairingEngine?: PairingEngine;
  sessionHealth?: SessionHealthService;
  cleanupEngine?: CleanupEngine;

  /**
   * Initialize all subsystems and register them in the DI container.
   */
  async initialize(): Promise<void> {
    log.info('Initializing PAPPYBOT V2...');

    // ── 1. Config ──────────────────────────────────────────────────────────
    config.load();
    config.onChange((key, _old, newVal) => {
      eventBus.emit('config:changed', { key, oldValue: _old, newValue: newVal });
    });
    container.register('Config', config);
    container.register('EventBus', eventBus);

    // ── 2. Cache ───────────────────────────────────────────────────────────
    const cacheManager = new CacheManager(
      undefined,
      config.get<number>('cache.ttl') ?? 300,
      config.get<number>('cache.cleanupInterval') ?? 60
    );
    container.register('CacheManager', cacheManager);

    // ── 3. Database ────────────────────────────────────────────────────────
    const dbConfig = (config.get('database') ?? { driver: 'sqlite' }) as unknown as DatabaseConfig;
    const dbManager = new DatabaseManager(dbConfig);
    await dbManager.connect();
    container.register('DatabaseManager', dbManager);

    // ── 4. Permissions ─────────────────────────────────────────────────────
    const globalOwner = config.get<string>('security.globalOwner');
    const permissions = new PermissionManager(cacheManager, globalOwner);
    container.register('PermissionManager', permissions);

    // ── 5. Session Manager ─────────────────────────────────────────────────
    const sessionsPath = config.get<string>('sessions.storagePath') ?? 'storage/sessions';
    const maxSessions = config.get<number>('sessions.maxSessions') ?? 10;
    const sessionManager = new SessionManager(
      eventBus,
      cacheManager,
      sessionsPath,
      maxSessions
    );
    container.register('SessionManager', sessionManager);

    // ── 6. Middleware Engine ───────────────────────────────────────────────
    const middlewareEngine = new MiddlewareEngine();
    middlewareEngine.use(new LoggingMiddleware());
    middlewareEngine.use(new MaintenanceMiddleware(permissions));
    middlewareEngine.use(
      new RateLimitMiddleware(
        cacheManager,
        config.get<number>('security.rateLimitWindow') ?? 60_000,
        config.get<number>('security.rateLimitMax') ?? 30
      )
    );
    container.register('MiddlewareEngine', middlewareEngine);

    // ── 7. Command Engine ──────────────────────────────────────────────────
    const prefix = config.get<string>('commands.prefix') ?? '!';
    const commandEngine = new CommandEngine(eventBus, cacheManager, permissions, prefix);
    container.register('CommandEngine', commandEngine);

    // ── 8. Response Engine ─────────────────────────────────────────────────
    const responseEngine = new ResponseEngine();
    container.register('ResponseEngine', responseEngine);

    // ── 9. Message Pipeline ────────────────────────────────────────────────
    const pipeline = new MessagePipeline(eventBus, middlewareEngine, commandEngine);
    container.register('MessagePipeline', pipeline);

    // ── 10. Scheduler ──────────────────────────────────────────────────────
    const timezone = config.get<string>('scheduler.timezone') ?? 'UTC';
    const scheduler = new SchedulerService(eventBus, timezone);
    container.register('SchedulerService', scheduler);

    // ── 11. Listener Manager ───────────────────────────────────────────────
    const listenerManager = new ListenerManager(eventBus);
    container.register('ListenerManager', listenerManager);

    // ── 12. Plugin Manager ─────────────────────────────────────────────────
    const pluginContext = {
      commands: commandEngine,
      listeners: listenerManager,
      middlewares: middlewareEngine,
      scheduler,
      bus: eventBus,
    };
    const pluginManager = new PluginManager(eventBus, pluginContext);
    container.register('PluginManager', pluginManager);

    // ── 13. WhatsApp Engine Services ───────────────────────────────────────
    // Shared group + contact caches (per-client caches are created in WhatsAppClient,
    // but a shared set is also registered for cross-session queries if needed).
    const sharedGroupCache = new GroupCache();
    const sharedContactCache = new ContactCache();

    const groupService = new GroupService(socketManager, sharedGroupCache, eventBus);
    const contactService = new ContactService(socketManager, sharedContactCache, eventBus);
    const profileService = new ProfileService(socketManager, eventBus);

    container.register('GroupService', groupService);
    container.register('ContactService', contactService);
    container.register('ProfileService', profileService);

    // ── 14. Runtime Monitor ────────────────────────────────────────────────
    const snapshotIntervalMs = config.get<number>('monitor.snapshotIntervalMs') ?? 60_000;
    this.monitor = new RuntimeMonitor(
      socketManager,
      sessionManager,
      cacheManager,
      eventBus,
      snapshotIntervalMs
    );
    this.monitor.start();
    container.register('RuntimeMonitor', this.monitor);

    // ── 15. Anti Engine ────────────────────────────────────────────────────
    const globalOwnerJid = `${(config.get<string>('security.globalOwner') ?? '').replace(/\D/g, '')}@s.whatsapp.net`;
    const antiEngine = new AntiEngine(
      socketManager,
      sharedGroupCache,
      eventBus,
      { ownerJid: globalOwnerJid, botJid: globalOwnerJid, sudoJids: [] }
    );
    container.register('AntiEngine', antiEngine);
    middlewareEngine.use(new AntiMiddleware(antiEngine));
    log.info('Anti Engine initialized');

    // ── 16. Group Management Plugin ────────────────────────────────────────
    const groupPlugin = new GroupManagementPlugin();
    await pluginManager.load(groupPlugin);
    log.info('Group Management plugin loaded');

    // ── 17. Group Status Engine ──────────────────────────────────────────────────────────────────
    const gstatusPlugin = new GStatusPlugin();
    await pluginManager.load(gstatusPlugin);
    container.register('GStatusPlugin', gstatusPlugin);
    log.info('Group Status Engine loaded');

    // ── 17b. AI Assistant & Automation Engine ─────────────────────────────
    const aiPlugin = new AIPlugin();
    await pluginManager.load(aiPlugin);
    container.register('AIPlugin', aiPlugin);
    log.info('AI Assistant & Automation Engine loaded');

    // ── 18. Pairing Engine & Connection Manager ────────────────────────────
    this.heartbeat = new HeartbeatMonitor(eventBus);
    this.heartbeat.start();
    container.register('HeartbeatMonitor', this.heartbeat);

    this.connectionManager = new ConnectionManager(this, sessionManager, this.heartbeat, eventBus);
    container.register('ConnectionManager', this.connectionManager);

    this.pairingEngine = new PairingEngine(this, sessionManager, this.heartbeat, eventBus);
    container.register('PairingEngine', this.pairingEngine);

    this.sessionHealth = new SessionHealthService(sessionManager, this.heartbeat);
    container.register('SessionHealthService', this.sessionHealth);

    this.cleanupEngine = new CleanupEngine(
      sessionManager,
      cacheManager,
      scheduler,
      this.heartbeat,
      eventBus,
      sessionsPath
    );
    container.register('CleanupEngine', this.cleanupEngine);
    log.info('Pairing Engine & Connection Manager initialized');

    // ── 19. Telegram Control Panel ────────────────────────────────────────
    const telegramToken = config.get<string>('telegram.botToken') ?? process.env['TELEGRAM_BOT_TOKEN'];
    if (telegramToken) {
      this.telegramBot = new TelegramBot(
        telegramToken,
        this,
        sessionManager,
        this.monitor,
        eventBus,
        sharedGroupCache,
        socketManager
      );
      await this.telegramBot.start();
      container.register('TelegramBot', this.telegramBot);
      log.info('Telegram Control Panel started');
    } else {
      log.warn('TELEGRAM_BOT_TOKEN not set — Telegram panel disabled');
    }

    // ── 20. Web Dashboard ──────────────────────────────────────────────────────────────────
    const webEnabled = process.env['WEB_ENABLED'] !== 'false';
    if (webEnabled) {
      this.webServer = new WebServer(
        this,
        sessionManager,
        this.monitor,
        eventBus,
        sharedGroupCache,
        socketManager,
        commandEngine
      );
      await this.webServer.start();
      container.register('WebServer', this.webServer);
      log.info('Web Dashboard started');
    }

    this.isRunning = true;
    log.success('All subsystems initialized');
  }

  /**
   * Start a WhatsApp session by creating and connecting a WhatsAppClient.
   */
  async startSession(sessionId: string): Promise<WhatsAppClient> {
    const sessionManager = container.resolve<SessionManager>('SessionManager');
    const pipeline = container.resolve<MessagePipeline>('MessagePipeline');
    const responseEngine = container.resolve<ResponseEngine>('ResponseEngine');
    const prefix = config.get<string>('commands.prefix') ?? '!';
    const storagePath = config.get<string>('sessions.storagePath') ?? 'storage/sessions';

    const session = sessionManager.require(sessionId);

    const client = new WhatsAppClient(
      sessionId,
      sessionManager,
      pipeline,
      responseEngine,
      eventBus,
      prefix,
      storagePath
    );

    this.clients.set(sessionId, client);
    await client.start();

    log.info('Session started', { sessionId, owner: session.config.owner });
    return client;
  }

  /**
   * Stop a session gracefully (disconnect only — preserves auth).
   */
  async stopSession(sessionId: string): Promise<void> {
    this.connectionManager?.markIntentionalStop(sessionId);
    const client = this.clients.get(sessionId);
    if (client) {
      await client.stop();
      this.clients.delete(sessionId);
    }
  }

  /**
   * Logout a session: disconnect + clear runtime, preserve auth for re-pair.
   */
  async logoutSession(sessionId: string): Promise<void> {
    this.connectionManager?.markIntentionalStop(sessionId);
    const client = this.clients.get(sessionId);
    if (client) await client.stop();
    this.clients.delete(sessionId);
    await this.cleanupEngine?.logout(sessionId);
  }

  /**
   * Delete a session permanently — removes all auth, storage, cache, jobs.
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.connectionManager?.markIntentionalStop(sessionId);
    const client = this.clients.get(sessionId);
    if (client) await client.stop();
    this.clients.delete(sessionId);
    await this.cleanupEngine?.delete(sessionId);
  }

  /**
   * Graceful application shutdown — stops all sessions and releases resources.
   */
  async shutdown(): Promise<void> {
    if (!this.isRunning) return;
    log.info('Shutting down PAPPYBOT V2...');

    // Stop web server
    await this.webServer?.stop();

    // Stop Telegram bot
    await this.telegramBot?.stop();

    // Stop runtime monitor
    this.monitor?.stop();

    // Stop heartbeat monitor
    this.heartbeat?.stop();

    // Stop all WhatsApp sessions
    for (const [id] of this.clients) {
      this.connectionManager?.markIntentionalStop(id);
      await this.stopSession(id);
    }

    // Clear all sockets
    socketManager.clear();

    // Shutdown scheduler
    const scheduler = container.tryResolve<SchedulerService>('SchedulerService');
    scheduler?.cancelAll();

    // Shutdown cache (stop cleanup timer)
    const cache = container.tryResolve<CacheManager>('CacheManager');
    cache?.shutdown();

    // Disconnect database
    const db = container.tryResolve<DatabaseManager>('DatabaseManager');
    await db?.disconnect();

    this.isRunning = false;
    log.info('PAPPYBOT V2 stopped cleanly');
  }

  getClient(sessionId: string): WhatsAppClient | undefined {
    return this.clients.get(sessionId);
  }

  getContainer(): typeof container {
    return container;
  }
}
