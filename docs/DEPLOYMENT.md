# PAPPYBOT V2 — Deployment Guide

## Requirements

- Node.js 20+
- npm 10+
- (Optional) Docker 24+ and Docker Compose v2

---

## Option A — Docker (recommended)

### 1. Clone and configure

```bash
git clone https://github.com/pappy999666-dotcom/ANTISYSTEM-.git
cd ANTISYSTEM-
cp .env.example .env
# Edit .env — set GLOBAL_OWNER_NUMBER, JWT_SECRET, WEB_SECRET at minimum
```

### 2. Build and start

```bash
docker compose up -d --build
```

The bot starts on port `3000` by default (`WEB_PORT` in `.env`).

### 3. View logs

```bash
docker compose logs -f pappybot
```

### 4. Scan QR

```bash
docker compose logs pappybot | grep -A 20 "QR code"
```

---

## Option B — Bare Metal

### 1. Install dependencies

```bash
npm ci
```

### 2. Build

```bash
npm run build
```

### 3. Start

```bash
npm start
```

### 4. Development (hot-reload)

```bash
npm run dev
```

---

## Nginx Reverse Proxy (HTTPS)

Copy `nginx.conf` to `/etc/nginx/sites-available/pappybot`, update `server_name` and SSL paths, then:

```bash
ln -s /etc/nginx/sites-available/pappybot /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GLOBAL_OWNER_NUMBER` | ✅ | — | Your WhatsApp number (no `+`, no spaces) |
| `JWT_SECRET` | ✅ | insecure default | Web dashboard JWT signing secret |
| `WEB_SECRET` | ✅ | insecure default | Login password for web dashboard |
| `NODE_ENV` | — | `development` | Set to `production` in prod |
| `LOG_LEVEL` | — | `info` | `trace` / `debug` / `info` / `warn` / `error` |
| `DB_DRIVER` | — | `sqlite` | `sqlite` / `mongodb` / `postgres` |
| `DB_SQLITE_PATH` | — | `storage/database.sqlite` | SQLite file path |
| `DB_MONGO_URI` | — | — | MongoDB connection URI |
| `DB_PG_HOST` | — | `localhost` | PostgreSQL host |
| `DB_PG_USER` | — | — | PostgreSQL user |
| `DB_PG_PASSWORD` | — | — | PostgreSQL password |
| `DB_PG_DATABASE` | — | `pappybot` | PostgreSQL database name |
| `SESSIONS_PATH` | — | `storage/sessions` | Auth storage directory |
| `TELEGRAM_BOT_TOKEN` | — | — | Enable Telegram control panel |
| `TELEGRAM_OWNER_ID` | — | — | Your Telegram user ID |
| `WEB_ENABLED` | — | `true` | Set to `false` to disable web server |
| `WEB_PORT` | — | `3000` | HTTP port |
| `WEB_ORIGIN` | — | `*` | CORS allowed origin |
| `CMD_PREFIX` | — | `!` | Command prefix character |

---

## Graceful Shutdown

The process handles `SIGINT` and `SIGTERM`:

1. Stops web server
2. Stops Telegram bot
3. Stops runtime monitor and heartbeat
4. Disconnects all WhatsApp sessions
5. Cancels all scheduler jobs
6. Shuts down cache cleanup timer
7. Disconnects database

Zero-downtime restarts are possible with a process manager:

```bash
# PM2
pm2 start dist/core/Bootstrap.js --name pappybot
pm2 reload pappybot   # graceful reload
```

---

## Health Check

```
GET /health
```

Returns:

```json
{
  "ok": true,
  "uptime": 3600.5,
  "version": "2.0.0",
  "sessions": { "total": 1, "connected": 1 },
  "memory": { "rss": "128.4 MB", "heapUsed": "64.2 MB" },
  "throughput": { "messagesReceived": 1024, "commandsExecuted": 88 },
  "activeSockets": 1
}
```

---

## Backup & Restore

```
POST   /api/backup              — create backup
GET    /api/backup              — list backups
POST   /api/backup/:id/restore  — restore config + database
DELETE /api/backup/:id          — delete backup
```

Backups are stored in `storage/backups/<timestamp>/` and include:
- `config.json`
- `database.sqlite`
- `sessions/<id>/` auth directories

---

## Storage Layout

```
storage/
├── sessions/       ← WhatsApp auth credentials (per session)
├── media/          ← Temporary media files (auto-cleaned)
├── backups/        ← Backup archives
└── database.sqlite ← Default SQLite database
logs/               ← Application logs
```
