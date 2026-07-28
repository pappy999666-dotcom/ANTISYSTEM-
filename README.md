<div align="center">

<!-- Animated wave header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:25D366,100:128C7E&height=220&section=header&text=PAPPYBOT%20V2&fontSize=72&fontColor=ffffff&fontAlignY=38&desc=Production-Grade%20WhatsApp%20Automation%20Platform&descAlignY=58&descSize=18&animation=fadeIn" width="100%"/>

<!-- Animated typing SVG -->
<img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=700&size=22&duration=3000&pause=800&color=25D366&center=true&vCenter=true&multiline=false&width=700&lines=AI-Powered+WhatsApp+Bot+%F0%9F%A4%96;Natural+Language+Control+%F0%9F%97%A3%EF%B8%8F;Multi-Session+Management+%F0%9F%94%A7;Group+Automation+Engine+%E2%9A%99%EF%B8%8F;Telegram+Control+Panel+%F0%9F%93%9F;Built+on+%40crysnovax%2Fbaileys+%F0%9F%9A%80" alt="Typing SVG" />

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
| `.kick @user` | Remove participant |
| `.promote @user` | Make admin |
| `.demote @user` | Remove admin |
| `.tag all` | Mention everyone |
| `.open` / `.close` | Toggle group mode |
| `.setname` | Rename group |

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

- Live session status
- Group overview
- Command logs
- Anti-system reports
- Runtime metrics (CPU, memory, uptime)

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
SESSION_SECRET=your-random-secret   # For session encryption
```

Optional extras:
```env
TELEGRAM_BOT_TOKEN=...              # Enable Telegram panel
WEB_ENABLED=true                    # Enable web dashboard
WEB_PORT=3000
```

### 3 — Run

```bash
# Development (hot-reload)
npm run dev

# Production
npm run build && npm start
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
    ctx.scheduler.schedule({ name: 'my-job', cronExpression: '0 * * * *', fn: myTask });
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
├── commands/         ← BaseCommand abstract class
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
├── services/         ← Group · Contact · Profile · RuntimeMonitor
├── telegram/         ← Telegram control panel (grammy)
├── types/            ← All shared TypeScript interfaces & enums
├── utils/            ← Helpers · JID · Time · Sanitize
└── web/              ← Express dashboard + REST API + JWT auth
```

---

## 🛠️ Development Scripts

```bash
npm run dev          # ts-node-dev with hot reload
npm run build        # compile TypeScript → dist/
npm start            # run compiled build
npm test             # jest unit tests
npm run test:watch   # jest in watch mode
npm run typecheck    # tsc --noEmit (zero-error check)
npm run lint         # eslint src/**/*.ts
```

---

## 📚 Documentation

| Doc | Description |
|---|---|
| [`docs/AI_ASSISTANT.md`](docs/AI_ASSISTANT.md) | AI providers, memory system, automation engine, planner |
| [`docs/WHATSAPP_ENGINE.md`](docs/WHATSAPP_ENGINE.md) | Baileys integration, message pipeline, normalizer |
| [`docs/ANTI_SYSTEM.md`](docs/ANTI_SYSTEM.md) | Detectors, warn/ban engine, permit system |
| [`docs/GROUP_MANAGEMENT.md`](docs/GROUP_MANAGEMENT.md) | Group commands, welcome/goodbye, admin protection |
| [`docs/TELEGRAM_PANEL.md`](docs/TELEGRAM_PANEL.md) | Telegram bot setup and available commands |
| [`docs/WEB_DASHBOARD.md`](docs/WEB_DASHBOARD.md) | Web UI, REST API reference, JWT auth |
| [`docs/SESSION_LIFECYCLE.md`](docs/SESSION_LIFECYCLE.md) | Pairing, reconnect, health monitoring, cleanup |

---

## 🗺️ Roadmap

- [x] Core engine (EventBus, DI, CommandEngine, MiddlewareEngine)
- [x] Multi-session WhatsApp management
- [x] Role-based permission system (5 levels)
- [x] Anti-abuse system (AntiLink, AntiSpam, AntiBot, Warn, Ban)
- [x] Group management module
- [x] Telegram control panel
- [x] Web dashboard
- [x] Group status / story automation engine
- [x] Production pairing engine (QR + pairing code, auto-reconnect)
- [x] **AI Assistant** (NL → actions, 5 providers, memory, scheduling)
- [x] **Automation Engine** (persisted cron tasks, natural language time)
- [ ] Intro card system
- [ ] AI API key encryption at rest
- [ ] AI status on Telegram + Web dashboards
- [ ] E2E test suite

---

<div align="center">

<!-- Animated footer wave -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=0:128C7E,50:25D366,100:0d1117&height=120&section=footer&animation=fadeIn" width="100%"/>

<br/>

**Built with ❤️ on [`@crysnovax/baileys`](https://github.com/crysnovax/baileys)**

[![GitHub stars](https://img.shields.io/github/stars/pappy999666-dotcom/ANTISYSTEM-?style=social)](https://github.com/pappy999666-dotcom/ANTISYSTEM-)
[![GitHub forks](https://img.shields.io/github/forks/pappy999666-dotcom/ANTISYSTEM-?style=social)](https://github.com/pappy999666-dotcom/ANTISYSTEM-)

*PappyBot V2 — Where every message is an opportunity*

</div>
