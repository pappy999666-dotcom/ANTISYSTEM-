# Web Dashboard & Intro System

Premium cyber-inspired web dashboard for PAPPYBOT V2. Auto-starts on port 3000 when `WEB_ENABLED=true`.

---

## Architecture

```
WebServer (Express + ws)
  ├── REST API  (/api/*)
  │     ├── /api/auth          — login, logout, me
  │     ├── /api/sessions      — CRUD + reconnect/logout
  │     ├── /api/groups        — list, get, participants, refresh
  │     ├── /api/runtime       — snapshot, users, maintenance (owner)
  │     ├── /api/intro         — config, questions, tokens, submissions
  │     ├── /api/upload        — file upload/serve/delete
  │     ├── /api/report        — anonymous report submission
  │     └── /api/bridge        — send messages/commands to WhatsApp
  ├── WebSocket (/ws)
  │     └── WsServer — bridges EventBus → browser clients
  ├── IntroService  — token engine, form builder, submission store, forward
  ├── ReportService — anonymous upload and report store
  └── StorageService — file storage, expiry, cleanup

Frontend (web/)
  ├── main.ts         — app entry, router, auth check
  ├── intro-main.ts   — public intro card page
  ├── upload-main.ts  — public anonymous upload page
  ├── pages/          — Dashboard, Sessions, Groups, Bridge, Logs, Intro, Owner, Login
  ├── components/     — Sidebar, Modal
  ├── stores/store.ts — reactive global state (EventTarget-based)
  ├── utils/api.ts    — typed fetch wrapper for all endpoints
  ├── utils/ws.ts     — WebSocket client with auto-reconnect
  ├── utils/toast.ts  — toast notifications
  └── styles/global.css — cyber dark glass design system
```

---

## Setup

```env
WEB_PORT=3000
WEB_ENABLED=true
WEB_SECRET=your-login-secret
JWT_SECRET=your-jwt-secret
TELEGRAM_OWNER_ID=your-telegram-id
```

Start the app — the web server starts automatically.

---

## Authentication

Login requires:
- **Telegram ID** — the user's Telegram user ID (must be registered via the Telegram bot first)
- **Web Secret** — set via `WEB_SECRET` env var

On success, a JWT cookie is set (7-day expiry). All API routes require this cookie.

The Global Owner (`TELEGRAM_OWNER_ID`) gets access to the Owner Panel.

---

## REST API

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Login with telegramId + secret |
| POST | `/api/auth/logout` | Clear session cookie |
| GET | `/api/auth/me` | Current user info |

### Sessions
| Method | Path | Description |
|---|---|---|
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Get session details |
| POST | `/api/sessions` | Create + start session |
| POST | `/api/sessions/:id/reconnect` | Reconnect session |
| POST | `/api/sessions/:id/logout` | Logout session |
| DELETE | `/api/sessions/:id` | Delete session |
| PATCH | `/api/sessions/:id` | Rename / update prefix |

### Groups
| Method | Path | Description |
|---|---|---|
| GET | `/api/groups` | List all cached groups |
| GET | `/api/groups/:jid` | Get group details |
| GET | `/api/groups/:jid/participants` | List participants |
| POST | `/api/groups/:jid/refresh` | Force metadata refresh |

### Runtime (Owner only for some)
| Method | Path | Description |
|---|---|---|
| GET | `/api/runtime/snapshot` | Live runtime metrics |
| GET | `/api/runtime/users` | All registered users (owner) |
| POST | `/api/runtime/users/:id/ban` | Ban user (owner) |
| POST | `/api/runtime/users/:id/unban` | Unban user (owner) |
| GET | `/api/runtime/maintenance` | Maintenance status (owner) |
| POST | `/api/runtime/maintenance` | Toggle maintenance (owner) |

### Intro System
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/intro/:groupJid/config` | Required | Get intro config |
| PUT | `/api/intro/:groupJid/config` | Required | Save intro config |
| POST | `/api/intro/:groupJid/questions` | Required | Add question |
| PATCH | `/api/intro/:groupJid/questions/:qid` | Required | Update question |
| DELETE | `/api/intro/:groupJid/questions/:qid` | Required | Delete question |
| POST | `/api/intro/:groupJid/questions/reorder` | Required | Reorder questions |
| POST | `/api/intro/:groupJid/token` | Required | Generate member token |
| POST | `/api/intro/:groupJid/destination` | Required | Set destination group |
| GET | `/api/intro/:groupJid/submissions` | Required | List submissions |
| POST | `/api/intro/submissions/:id/forward` | Required | Forward submission |
| GET | `/api/intro/form/:token` | Public | Get form for member |
| POST | `/api/intro/upload/:token` | Public | Upload media |
| POST | `/api/intro/submit/:token` | Public | Submit intro form |

### Bridge
| Method | Path | Description |
|---|---|---|
| POST | `/api/bridge/send` | Send message/media to WhatsApp group |
| GET | `/api/bridge/commands` | List available commands |

### Upload / Report
| Method | Path | Description |
|---|---|---|
| POST | `/api/upload` | Upload anonymous file |
| GET | `/api/upload/:id` | Serve uploaded file |
| DELETE | `/api/upload/:id` | Delete file (auth) |
| POST | `/api/report` | Submit anonymous report |
| GET | `/api/report` | List reports (owner) |
| POST | `/api/report/destination` | Set report destination (owner) |

---

## WebSocket Events

Connect: `ws://host/ws?token=<jwt>`

| Event | Direction | Payload |
|---|---|---|
| `session:connected` | Server→Client | `{ sessionId, phoneNumber }` |
| `session:disconnected` | Server→Client | `{ sessionId, reason }` |
| `session:state_changed` | Server→Client | `{ sessionId, state }` |
| `runtime:snapshot` | Server→Client | Full RuntimeSnapshot |
| `log:line` | Server→Client | `{ line, ts }` |
| `intro:submitted` | Server→Client | `{ submissionId, groupJid }` |
| `upload:complete` | Server→Client | `{ id, name }` |
| `group:updated` | Server→Client | `{ sessionId, groupJid }` |
| `anti:triggered` | Server→Client | Anti event payload |
| `notification` | Server→Client | `{ message }` |
| `ping` | Client→Server | `{ type: 'ping' }` |

---

## Intro System Flow

```
Admin configures group intro (questions, destination, settings)
  → Member joins WhatsApp group
  → Admin generates token: POST /api/intro/:groupJid/token
  → Member receives URL: domain.com/intro.html?token=<token>
  → Member fills form (step-by-step, progress bar)
  → Member uploads media (if required)
  → Member reviews answers
  → Member submits: POST /api/intro/submit/:token
  → Submission stored
  → If forwardEnabled: auto-forwarded to destination WhatsApp group
  → Admin can manually forward: POST /api/intro/submissions/:id/forward
```

Token expiry is configurable per group (default 48 hours).

---

## Public Pages

| URL | Description |
|---|---|
| `/` | Main dashboard (requires login) |
| `/intro.html?token=<token>` | Member intro card form |
| `/upload.html` | Anonymous upload / report |

---

## Frontend Build

```bash
cd web
npm install
npm run dev      # development (proxies to :3000)
npm run build    # production build → web/dist/
```

The backend serves `web/dist/` as static files in production.

---

## Storage

Files stored in `storage/uploads/`. Metadata in `storage/upload_meta.json`.

Default expiry: 72 hours. Cleanup runs every hour automatically.

---

## Security

- JWT auth with httpOnly cookies
- Rate limiting: 200 req/min general, 20 req/min on auth routes
- Helmet security headers
- CORS with configurable origin
- File type and size validation on all uploads
- Owner-only routes protected by `requireOwner` middleware
- Users can only access their own sessions and groups

---

## Extension Points

- Swap `StorageService` to S3/R2 for cloud storage
- Add Redis session store for horizontal scaling
- Implement virus scan hook in `StorageService.store()`
- Add approval workflow for intro submissions
- Wire AI assistant settings when Prompt 7 is implemented
- Add virtualized tables for large group/session lists
- Implement infinite scroll on groups page
