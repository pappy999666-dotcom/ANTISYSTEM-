<div align="center">

<!-- Animated wave header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,30:0a3d1f,60:25D366,100:128C7E&height=240&section=header&text=PAPPYBOT%20V2&fontSize=78&fontColor=ffffff&fontAlignY=38&desc=Production-Grade%20WhatsApp%20Automation%20Platform&descAlignY=58&descSize=19&animation=fadeIn" width="100%"/>

<!-- Live matrix rain effect -->
<img src="https://raw.githubusercontent.com/rodrigograca31/rodrigograca31/master/matrix.svg" width="100%" height="80"/>

<!-- Animated typing SVG — cycles through all major features -->
<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=22&duration=2500&pause=600&color=25D366&center=true&vCenter=true&multiline=false&width=750&lines=AI-Powered+WhatsApp+Bot+%F0%9F%A4%96;Natural+Language+Control+%F0%9F%97%A3%EF%B8%8F;Multi-Session+Management+%F0%9F%94%A7;Group+Automation+Engine+%E2%9A%99%EF%B8%8F;Telegram+Control+Panel+%F0%9F%93%9F;Anti-Abuse+%26+Moderation+System+%F0%9F%9B%A1%EF%B8%8F;Role-Based+Permission+System+%F0%9F%94%90;Backup+%26+Restore+Engine+%F0%9F%92%BE;93+Tests+%E2%80%A2+Zero+TypeScript+Errors+%E2%9C%85;Built+on+%40crysnovax%2Fbaileys+%F0%9F%9A%80;Production+Ready+%E2%80%A2+Docker+Ready+%F0%9F%90%B3;PappyBot+V2+%E2%80%94+Where+Every+Message+Matters" alt="Typing SVG" />

<br/>

<!-- Badges row 1 -->
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-F7DF1E?style=for-the-badge&logo=opensourceinitiative&logoColor=black)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](package.json)

<!-- Badges row 2 -->
[![SQLite](https://img.shields.io/badge/SQLite-Default_DB-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Supported-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supported-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Control_Panel-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://telegram.org/)

<!-- Badges row 3 — new production badges -->
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](Dockerfile)
[![Tests](https://img.shields.io/badge/Tests-93%20Passing-25D366?style=for-the-badge&logo=jest&logoColor=white)](tests/)
[![Zero TS Errors](https://img.shields.io/badge/TypeScript-Zero%20Errors-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](tsconfig.json)
[![Pino](https://img.shields.io/badge/Logger-Pino-green?style=for-the-badge&logo=node.js&logoColor=white)](https://getpino.io/)

</div>

---

<div align="center">

```
██████╗  █████╗ ██████╗ ██████╗ ██╗   ██╗██████╗  ██████╗ ████████╗
██╔══██╗██╔══██╗██╔══██╗██╔══██╗╚██╗ ██╔╝██╔══██╗██╔═══██╗╚══██╔══╝
██████╔╝███████║██████╔╝██████╔╝ ╚████╔╝ ██████╔╝██║   ██║   ██║   
██╔═══╝ ██╔══██║██╔═══╝ ██╔═══╝   ╚██╔╝  ██╔══██╗██║   ██║   ██║   
██║     ██║  ██║██║     ██║        ██║   ██████╔╝╚██████╔╝   ██║   
╚═╝     ╚═╝  ╚═╝╚═╝     ╚═╝        ╚═╝   ╚═════╝  ╚═════╝    ╚═╝   
                                                        V 2 . 0 . 0
```

*Every module is isolated. Business logic lives in services — never in commands or listeners.*

<!-- Live activity graph -->
<img src="https://github-readme-activity-graph.vercel.app/graph?username=pappy999666-dotcom&bg_color=0d1117&color=25D366&line=128C7E&point=25D366&area=true&hide_border=true" width="100%"/>

</div>

---

## ⚡ What is PappyBot V2?

**PappyBot V2** is a production-grade, multi-session WhatsApp automation platform. It connects to WhatsApp via `@crysnovax/baileys`, exposes a layered architecture of isolated services, and ships with a full AI assistant that understands natural language — letting you control your bot by simply typing `pappy close the group at 10 PM`.

<details>
<summary><b>🔍 Why PappyBot over a simple bot script?</b></summary>
<br>

| Capability | Simple Script | PappyBot V2 |
|---|:---:|:---:|
| Multi-session (multiple numbers) | ❌ | ✅ |
| Hot-reload plugins without restart | ❌ | ✅ |
| Driver-agnostic database (SQLite/Mongo/PG) | ❌ | ✅ |
| Typed event bus (no spaghetti imports) | ❌ | ✅ |
| Role-based permission system (5 levels) | ❌ | ✅ |
| Natural language AI control | ❌ | ✅ |
| Telegram control panel | ❌ | ✅ |
| Web dashboard | ❌ | ✅ |
| Automated restart & health monitoring | ❌ | ✅ |
| Backup & restore system | ❌ | ✅ |
| Docker + Nginx ready | ❌ | ✅ |
| 93 automated tests | ❌ | ✅ |

</details>

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PAPPYBOT V2                                │
│                                                                     │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐  │
│  │WhatsApp │──▶│ Message  │──▶│Middleware│──▶│ Command Engine   │  │
│  │ Client  │   │ Pipeline │   │ Pipeline │   │ (prefix + RBAC)  │  │
│  └─────────┘   └──────────┘   └──────────┘   └──────────────────┘  │
│       │                                               │             │
│       ▼                                               ▼             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐  │
│  │ Session  │   │  Event   │   │   DI     │   │   AI Assistant   │  │
│  │ Manager  │──▶│   Bus    │──▶│Container │──▶│ (NL → Actions)   │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────────┘  │
│       │                                               │             │
│       ▼                                               ▼             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────────┐  │
│  │Permission│   │ Database │   │  Cache   │   │ Scheduler        │  │
│  │ Manager  │   │ Manager  │   │ Manager  │   │ (cron + persist) │  │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────────┘  │
│                                                                     │
│  ┌────────────────┐   ┌────────────────┐   ┌───────────────────┐   │
│  │ Telegram Panel │   │  Web Dashboard │   │   Plugin Manager  │   │
│  └────────────────┘   └────────────────┘   └───────────────────┘   │
│                                                                     │
│  ┌────────────────┐   ┌────────────────┐                           │
│  │ Backup Service │   │ Runtime Monitor│                           │
│  └────────────────┘   └────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Data flow:** `Receive → Normalize → Validate → Middleware → Emit → Command/AI → Execute → Reply`

---

## ✨ Feature Modules

<table>
<tr>
<td width="50%">

### 🤖 AI Assistant
Natural language control powered by your choice of AI provider.

```
pappy close the group at 10 PM
pappy mute everyone for 2 hours  
pappy send a message every Monday at 9 AM
pappy warn @user for spamming
pappy enable antilink
```

**Providers:** OpenAI · Groq · Gemini · Anthropic · OpenRouter

</td>
<td width="50%">

### 🛡️ Anti-Abuse System
Intelligent group protection with configurable detectors.

- **AntiLink** — block external URLs
- **AntiSpam** — flood detection & auto-kick
- **AntiBot** — bot account detection
- **AntiNSFW** — content filtering
- **Warn System** — progressive strikes
- **Ban Engine** — permanent bans with audit log

</td>
</tr>
<tr>
<td width="50%">

### 👥 Group Management
Full admin toolkit via commands.

| Command | Action |
|---|---|
| `!kick @user` | Remove participant |
| `!promote @user` | Make admin |
| `!demote @user` | Remove admin |
| `!tag all` | Mention everyone |
| `!open` / `!close` | Toggle group mode |
| `!setname` | Rename group |

</td>
<td width="50%">

### ⏰ Automation Engine
Cron-based scheduling that survives restarts.

```typescript
// Create from natural language
automationService.createFromNaturalLanguage(
  sessionId,
  'Daily greeting',
  'every day at 9 AM',
  'send_message',
  { text: 'Good morning! 🌅' }
)
```

Tasks persisted in DB → auto-restored on boot.

</td>
</tr>
<tr>
<td width="50%">

### 📟 Telegram Control Panel
Manage your bot remotely without WhatsApp access.

- Session status monitoring
- Start / stop / delete sessions
- View group lists
- Broadcast messages
- Runtime statistics

</td>
<td width="50%">

### 🌐 Web Dashboard
Browser-based UI with JWT authentication.

- Live session status via WebSocket
- Group overview
- Command logs
- Anti-system reports
- Runtime metrics (CPU, memory, uptime)

</td>
</tr>
<tr>
<td width="50%">

### 💾 Backup & Restore
Full backup system for config, database, and sessions.

```
POST /api/backup              ← create backup
GET  /api/backup              ← list backups
POST /api/backup/:id/restore  ← restore
DELETE /api/backup/:id        ← delete
```

Auto-prune backups older than N days.

</td>
<td width="50%">

### 📊 Runtime Monitor
Live operational metrics across all sessions.

- Memory (RSS + heap)
- CPU load average
- Message throughput
- Command execution stats
- Reconnect counters
- Socket health per session

</td>
</tr>
</table>

---

## 🔐 Permission System

```
GLOBAL_OWNER  ─── Superuser across all sessions
      │
SESSION_OWNER ─── Full control of their session
      │
    SUDO      ─── Can use privileged commands + AI
      │
   ADMIN      ─── Group admin-level commands
      │
   USER       ─── Public commands only
```

Permissions are cached (60s TTL), session-scoped, and enforced at every layer — command engine, middleware, and AI listener.

---

## 🗄️ Database Support

| Driver | Config Key | Notes |
|---|---|---|
| **SQLite** *(default)* | `DB_DRIVER=sqlite` | Zero setup, file-based |
| **MongoDB** | `DB_DRIVER=mongodb` | Requires URI |
| **PostgreSQL** | `DB_DRIVER=postgres` | Requires host/user/pass |

Switch drivers in `.env` — no business logic changes required. All repositories use `BaseRepository` which is driver-agnostic.

---

## 🚀 Getting Started

### 1 — Clone & Install

```bash
git clone https://github.com/pappy999666-dotcom/ANTISYSTEM-.git
cd ANTISYSTEM-
npm install
```

### 2 — Configure

```bash
cp .env.example .env
```

Open `.env` and set **at minimum**:

```env
GLOBAL_OWNER_NUMBER=628xxxxxxxxxx   # Your WhatsApp number (no +, no spaces)
JWT_SECRET=your-random-secret       # Web dashboard JWT secret
WEB_SECRET=your-login-password      # Web dashboard login password
```

Optional extras:
```env
TELEGRAM_BOT_TOKEN=...              # Enable Telegram panel
TELEGRAM_OWNER_ID=...               # Your Telegram user ID
WEB_ENABLED=true                    # Enable web dashboard
WEB_PORT=3000
DB_DRIVER=sqlite                    # or: mongodb, postgres
```

### 3 — Run

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build && npm start

# Docker
docker compose up -d --build
```

A QR code will appear in the terminal — scan it with WhatsApp to authenticate.

### 4 — Enable the AI Assistant

In a private WhatsApp chat with your bot number:

```
.setaitoken sk-...         ← your OpenAI / Groq / Gemini key
.setaiprovider openai      ← or: groq, gemini, anthropic, openrouter
.setaimodel gpt-4o-mini    ← or any model your provider supports
.ai on
```

Then speak naturally:
```
pappy close the group tomorrow at 10 PM
pappy kick anyone who joins twice
pappy send a good morning message every day at 8 AM
```

---

## 🐳 Docker Deployment

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f pappybot

# Stop
docker compose down
```

With PostgreSQL:
```bash
docker compose --profile postgres up -d --build
```

Health check endpoint: `GET /health`

---

## 🧩 Plugin System

Create a plugin in three steps:

```typescript
// 1. Define
import { BasePlugin, type PluginContext } from '@plugins/BasePlugin';

export class MyPlugin extends BasePlugin {
  readonly meta = {
    id: 'my-plugin', name: 'My Plugin',
    version: '1.0.0', description: 'Does cool stuff'
  };

  async load(ctx: PluginContext): Promise<void> {
    ctx.commands.register(new MyCommand());
    ctx.listeners.register(new MyListener());
    ctx.scheduler.schedule({ name: 'my-job', cronExpression: '0 * * * *', fn: myTask, enabled: true });
  }
}

// 2. Register (App.ts)
await pluginManager.load(new MyPlugin());

// 3. Ship
```

---

## 📁 Project Structure

```
src/
├── ai/               ← AI Assistant & Automation Engine
│   ├── commands/     ← .ai .setaiprovider .setaimodel etc.
│   ├── listener/     ← Natural language message interceptor
│   ├── providers/    ← OpenAI · Groq · Gemini · Anthropic · OpenRouter
│   ├── repository/   ← Settings · Memory · Automations (DB)
│   ├── services/     ← Config · Memory · Provider · Planner · Executor
│   └── utils/        ← Time parser (natural language → cron/ISO)
├── anti/             ← Anti-abuse system (spam, link, NSFW, bot, warn, ban)
├── cache/            ← TTL-aware memory cache
├── commands/         ← BaseCommand abstract class + built-ins
├── config/           ← ConfigManager (env + JSON, hot-reload)
├── core/             ← App · Bootstrap · DI Container
├── database/         ← DatabaseManager · BaseRepository · SQLite/Mongo/PG
├── engines/          ← CommandEngine · MessagePipeline · ResponseEngine
├── events/           ← EventBus (typed async pub/sub)
├── group/            ← Group management plugin + commands
├── gstatus/          ← Group status/story automation
├── listeners/        ← BaseListener · ListenerManager
├── logger/           ← Pino structured logger
├── managers/         ← SessionManager (multi-account)
├── middlewares/      ← Logging · Maintenance · RateLimit · Anti
├── pairing/          ← PairingEngine · ConnectionManager · Heartbeat
├── permissions/      ← PermissionManager (RBAC, 5 roles)
├── plugins/          ← BasePlugin · PluginManager
├── schedulers/       ← SchedulerService (cron + events)
├── services/         ← Group · Contact · Profile · RuntimeMonitor · BackupService
├── telegram/         ← Telegram control panel (grammy)
├── types/            ← All shared TypeScript interfaces & enums
├── ui/               ← ResponseFormatter (gothic/cyber design system)
├── utils/            ← Helpers · JID · Time · Sanitize · TargetResolver
└── web/              ← Express dashboard + REST API + JWT auth
tests/
├── unit/             ← Unit tests (cache, commands, events, permissions, utils, scheduler)
└── integration/      ← Integration tests (pipeline, backup)
docs/
├── ARCHITECTURE.md
├── API_REFERENCE.md
├── COMMAND_REFERENCE.md
├── DEVELOPER_GUIDE.md
├── DEPLOYMENT.md
├── TROUBLESHOOTING.md
├── AI_ASSISTANT.md
├── ANTI_SYSTEM.md
├── GROUP_MANAGEMENT.md
├── SESSION_LIFECYCLE.md
├── TELEGRAM_PANEL.md
└── WEB_DASHBOARD.md
```

---

## 🛠️ Development Scripts

```bash
npm run dev          # ts-node-dev with hot reload
npm run build        # compile TypeScript → dist/
npm start            # run compiled build
npm test             # jest — 93 tests
npm run test:watch   # jest in watch mode
npm run typecheck    # tsc --noEmit (zero-error check)
npm run lint         # eslint src/**/*.ts
```

---

## 📚 Documentation

| Doc | Description |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design, module map, event catalogue |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Docker, bare-metal, nginx, env vars |
| [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | All REST endpoints + WebSocket events |
| [`docs/COMMAND_REFERENCE.md`](docs/COMMAND_REFERENCE.md) | Every command with usage examples |
| [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md) | Adding commands, plugins, repositories |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Common issues and FAQ |
| [`docs/AI_ASSISTANT.md`](docs/AI_ASSISTANT.md) | AI providers, memory system, automation engine |
| [`docs/WHATSAPP_ENGINE.md`](docs/WHATSAPP_ENGINE.md) | Baileys integration, message pipeline |
| [`docs/ANTI_SYSTEM.md`](docs/ANTI_SYSTEM.md) | Detectors, warn/ban engine, permit system |
| [`docs/GROUP_MANAGEMENT.md`](docs/GROUP_MANAGEMENT.md) | Group commands, welcome/goodbye |
| [`docs/TELEGRAM_PANEL.md`](docs/TELEGRAM_PANEL.md) | Telegram bot setup and commands |
| [`docs/WEB_DASHBOARD.md`](docs/WEB_DASHBOARD.md) | Web UI, REST API, JWT auth |
| [`docs/SESSION_LIFECYCLE.md`](docs/SESSION_LIFECYCLE.md) | Pairing, reconnect, health monitoring |

---

## 🗺️ Roadmap

- [x] Core engine (EventBus, DI, CommandEngine, MiddlewareEngine)
- [x] Multi-session WhatsApp management
- [x] Role-based permission system (5 levels)
- [x] Anti-abuse system (AntiLink, AntiSpam, AntiBot, Warn, Ban)
- [x] Group management module
- [x] Telegram control panel
- [x] Web dashboard + WebSocket live updates
- [x] Group status / story automation engine
- [x] Production pairing engine (QR + pairing code, auto-reconnect)
- [x] **AI Assistant** (NL → actions, 5 providers, memory, scheduling)
- [x] **Automation Engine** (persisted cron tasks, natural language time)
- [x] **Backup & Restore System**
- [x] **Docker + Nginx deployment**
- [x] **93 automated tests (unit + integration)**
- [x] **Full documentation suite (12 docs)**
- [x] **Health check endpoint**
- [ ] Intro card system
- [ ] AI API key encryption at rest
- [ ] AI status on Telegram + Web dashboards
- [ ] E2E test suite

---

<div align="center">

<!-- Snake animation on contributions -->
<img src="https://raw.githubusercontent.com/platane/snk/output/github-contribution-grid-snake-dark.svg" width="100%"/>

<!-- Animated footer wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:128C7E,50:25D366,100:0d1117&height=140&section=footer&animation=fadeIn&text=PappyBot%20V2&fontSize=28&fontColor=ffffff&fontAlignY=65" width="100%"/>

<br/>

**Built with ❤️ on [`@crysnovax/baileys`](https://github.com/crysnovax/baileys)**

[![GitHub stars](https://img.shields.io/github/stars/pappy999666-dotcom/ANTISYSTEM-?style=social)](https://github.com/pappy999666-dotcom/ANTISYSTEM-)
[![GitHub forks](https://img.shields.io/github/forks/pappy999666-dotcom/ANTISYSTEM-?style=social)](https://github.com/pappy999666-dotcom/ANTISYSTEM-)

*PappyBot V2 — Where every message is an opportunity*

</div>
