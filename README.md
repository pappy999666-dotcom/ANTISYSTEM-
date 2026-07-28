# ANTISYSTEM- / PAPPYBOT V2

Production-grade WhatsApp automation platform built on `@crysnovax/baileys`.

---

## Architecture

```
Core → Services → Managers → Engines → Events → Commands → UI
```

Every module is isolated. Business logic lives in services — never in commands or listeners. Future features (anti-abuse, Telegram panel, web dashboard, AI assistant, group management) plug in without touching the core.

### Subsystems

| Layer | Purpose |
|---|---|
| **Logger** | Pino-based structured logging (TRACE→FATAL + SUCCESS + PERF) |
| **ConfigManager** | Env + JSON config, hot-reloadable |
| **EventBus** | Typed async pub/sub — all cross-module communication |
| **CacheManager** | TTL-aware memory cache with namespace support |
| **DatabaseManager** | Driver-agnostic (SQLite / MongoDB / PostgreSQL) |
| **PermissionManager** | RBAC: GLOBAL_OWNER > SESSION_OWNER > SUDO > ADMIN > USER |
| **SessionManager** | Isolated workspaces per WhatsApp account |
| **MiddlewareEngine** | Priority-ordered pipeline (logging, maintenance, rate limit, …) |
| **CommandEngine** | Registry, aliases, cooldowns, arg parser, permission checks |
| **MessagePipeline** | Receive → Normalize → Validate → Middleware → Emit → Command |
| **ResponseEngine** | Unified outgoing message builder (text/image/video/audio/…) |
| **SchedulerService** | Cron-based job scheduler with event emission |
| **PluginManager** | Load/unload plugins with dependency ordering |
| **Container** | Lightweight DI service locator |

---

## Project Structure

```
src/
  core/          App, Bootstrap, Container (DI)
  config/        ConfigManager
  logger/        Logger (pino)
  events/        EventBus, EventTypes
  listeners/     BaseListener, ListenerManager
  middlewares/   MiddlewareEngine, BaseMiddleware, built-in/
  managers/      SessionManager
  engines/       CommandEngine, MessagePipeline, ResponseEngine
  commands/      BaseCommand
  permissions/   PermissionManager
  database/      DatabaseManager, BaseRepository, adapters/
  cache/         CacheManager, MemoryStore
  schedulers/    SchedulerService
  plugins/       PluginManager, BasePlugin
  services/      BaseService
  types/         All shared interfaces/enums
  constants/     App-wide constants
  utils/         helpers, sanitize, jid, time
  whatsapp/      WhatsAppClient, MessageNormalizer
config/
  config.json
tests/
  unit/
storage/
  sessions/      WhatsApp auth state per session
  media/
assets/
  templates/
  locales/
logs/
```

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — at minimum set GLOBAL_OWNER_NUMBER
```

### 3. Run in development

```bash
npm run dev
```

A QR code will appear in the terminal. Scan it with WhatsApp.

### 4. Build for production

```bash
npm run build
npm start
```

---

## Adding Features

### New command
```ts
import { BaseCommand } from '@commands/BaseCommand';
export class PingCommand extends BaseCommand {
  meta = { name: 'ping', description: 'Pong!', category: 'utility' };
  async execute(ctx) { await ctx.reply('Pong!'); }
}
// In your plugin's load():
ctx.commands.register(new PingCommand());
```

### New plugin
```ts
import { BasePlugin } from '@plugins/BasePlugin';
export class MyPlugin extends BasePlugin {
  meta = { id: 'my-plugin', name: 'My Plugin', version: '1.0.0', description: '...' };
  async load(ctx) { ctx.commands.register(new PingCommand()); }
}
```

### New listener
```ts
import { BaseListener } from '@listeners/BaseListener';
export class OnMessageListener extends BaseListener {
  name = 'OnMessage';
  event = 'message:received' as const;
  async handle(payload) { /* ... */ }
}
```

---

## Testing

```bash
npm test           # run all tests
npm run test:watch # watch mode
```

Tests run without a live WhatsApp connection.

---

## Database

Default: **SQLite** (`storage/database.sqlite`).

Switch by setting `DB_DRIVER=mongodb` or `DB_DRIVER=postgres` in `.env` and providing connection details. No business logic changes required.

---

## Next Prompts / Roadmap

- [ ] Anti-abuse system
- [ ] Group management module
- [ ] Telegram control panel
- [ ] Web dashboard
- [ ] AI assistant
- [ ] Intro card system
- [ ] Automation engine
