# PAPPYBOT V2 — Architecture Overview

## Design Principles

- **Layered architecture** — UI → Commands → Services → Repositories → Adapters
- **Dependency injection** — all singletons registered in `Container`, never imported directly between modules
- **Event-driven** — modules communicate via `EventBus`, not direct method calls
- **Session isolation** — each WhatsApp account is a fully independent `WhatsAppClient` instance
- **Driver-agnostic storage** — `BaseRepository` abstracts SQLite / MongoDB / PostgreSQL

---

## Startup Sequence

```
Bootstrap.ts
  └─ App.initialize()
       1.  Config (env + JSON)
       2.  Cache (MemoryStore)
       3.  Database (SQLite / Mongo / PG)
       4.  PermissionManager (RBAC)
       5.  SessionManager
       6.  MiddlewareEngine (Logging, Maintenance, RateLimit)
       7.  CommandEngine (prefix + RBAC + cooldown)
       8.  ResponseEngine (outgoing message builder)
       9.  MessagePipeline (receive → middleware → command)
       10. SchedulerService (cron + events)
       11. ListenerManager
       12. PluginManager
       13. WhatsApp services (GroupService, ContactService, ProfileService)
       14. RuntimeMonitor
       15. AntiEngine + AntiMiddleware
       16. GroupManagementPlugin
       17. GStatusPlugin
       17b.AIPlugin
       18. PairingEngine + ConnectionManager + HeartbeatMonitor
       19. TelegramBot (optional)
       20. WebServer (optional)
```

---

## Message Flow

```
WhatsApp socket
  └─ messages.upsert
       └─ MessageNormalizer.normalize()
            └─ MessagePipeline.process()
                 1. validate (id, sessionId, chatJid, sender, not-bot)
                 2. sanitizeInput (strip null bytes, truncate)
                 3. MiddlewareEngine.run()
                    ├─ LoggingMiddleware
                    ├─ MaintenanceMiddleware
                    ├─ RateLimitMiddleware
                    └─ AntiMiddleware → AntiEngine.inspect()
                 4. EventBus.emit('message:received')
                    └─ AIMessageListener (if AI enabled)
                 5. CommandEngine.handle() (if isCommand)
                    ├─ permission check
                    ├─ cooldown check
                    └─ handler.execute(ctx)
```

---

## Module Map

| Path | Responsibility |
|---|---|
| `src/core/` | App wiring, DI container, Bootstrap entry |
| `src/config/` | ConfigManager (env + JSON, hot-reload) |
| `src/events/` | EventBus (typed async pub/sub) |
| `src/cache/` | CacheManager + MemoryStore (TTL, namespaces) |
| `src/database/` | DatabaseManager + BaseRepository + adapters |
| `src/permissions/` | PermissionManager (5-level RBAC) |
| `src/managers/` | SessionManager (multi-account lifecycle) |
| `src/middlewares/` | MiddlewareEngine + built-in middlewares |
| `src/engines/` | CommandEngine, MessagePipeline, ResponseEngine |
| `src/schedulers/` | SchedulerService (cron + events) |
| `src/listeners/` | BaseListener, ListenerManager |
| `src/plugins/` | BasePlugin, PluginManager |
| `src/whatsapp/` | WhatsAppClient, SocketManager, AuthManager, caches |
| `src/pairing/` | PairingEngine, ConnectionManager, HeartbeatMonitor |
| `src/anti/` | AntiEngine + all detectors + ActionEngine |
| `src/group/` | Group management commands + engines |
| `src/gstatus/` | Group status/story automation |
| `src/ai/` | AI assistant, providers, automation engine |
| `src/telegram/` | Telegram control panel (grammy) |
| `src/web/` | Express REST API + WebSocket + JWT auth |
| `src/services/` | GroupService, ContactService, RuntimeMonitor, BackupService |
| `src/ui/` | ResponseFormatter (gothic/cyber design system) |
| `src/utils/` | JID, sanitize, time, helpers, TargetResolver |

---

## Permission Hierarchy

```
GLOBAL_OWNER  (level 5) — superuser across all sessions
SESSION_OWNER (level 4) — full control of their session
SUDO          (level 3) — privileged commands + AI
ADMIN         (level 2) — group admin-level commands
USER          (level 1) — public commands only
```

Permissions are cached with 60s TTL and invalidated on assignment/revocation.

---

## Event Catalogue

| Event | Payload |
|---|---|
| `session:connected` | `{ sessionId, phoneNumber }` |
| `session:disconnected` | `{ sessionId, reason }` |
| `session:qr` | `{ sessionId, qr }` |
| `session:pairing_code` | `{ sessionId, code }` |
| `message:received` | `{ message, context? }` |
| `command:executed` | `{ commandName, sessionId, senderJid, success, durationMs }` |
| `command:error` | `{ commandName, sessionId, error }` |
| `anti:triggered` | `{ sessionId, groupJid, senderJid, detectorId, action, reason }` |
| `monitor:snapshot` | `{ sessionId, stats }` |
| `task:scheduled` | `{ jobId, cron }` |
| `task:executed` | `{ jobId, durationMs }` |
| `task:failed` | `{ jobId, error }` |
