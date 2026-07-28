# PAPPYBOT V2 — API Reference

All endpoints are prefixed with `/api`. Authentication uses a JWT cookie (`token`) or `Authorization: Bearer <token>` header.

---

## Authentication

### POST /api/auth/login

Login with Telegram identity.

**Body:**
```json
{ "telegramId": 123456789, "secret": "your-WEB_SECRET" }
```

**Response:**
```json
{ "ok": true, "user": { "id": 123456789, "displayName": "Alice", "domain": "alice" } }
```

Sets an `httpOnly` cookie `token` valid for 7 days.

---

### POST /api/auth/logout

Clears the auth cookie.

---

### GET /api/auth/me

Returns the current authenticated user. Requires auth.

---

## Sessions

### GET /api/sessions

List all sessions. Requires auth.

### POST /api/sessions

Create a new session.

**Body:**
```json
{ "owner": "628123456789", "label": "my-session" }
```

### POST /api/sessions/:id/start

Start (connect) a session.

### POST /api/sessions/:id/stop

Stop (disconnect) a session gracefully.

### DELETE /api/sessions/:id

Delete a session permanently (removes auth).

### GET /api/sessions/:id/qr

Get the current QR code for a session (if in `qr_pending` state).

### POST /api/sessions/:id/pair

Request a pairing code.

**Body:**
```json
{ "phone": "628123456789" }
```

---

## Groups

### GET /api/groups

List all cached groups across all sessions. Requires auth.

### GET /api/groups/:sessionId

List groups for a specific session.

---

## Runtime

### GET /api/runtime/snapshot

Returns a full `RuntimeSnapshot` including session stats, memory, throughput. Requires auth.

### GET /api/runtime/summary

Returns a plain-text summary string.

---

## Backup

### GET /api/backup

List all backups. Requires owner.

### POST /api/backup

Create a new backup. Returns `{ ok: true, id: "2025-..." }`. Requires owner.

### POST /api/backup/:id/restore

Restore config and database from a backup. Requires owner.

### DELETE /api/backup/:id

Delete a backup. Requires owner.

---

## Bridge

### POST /api/bridge/execute

Execute a WhatsApp command via the web API.

**Body:**
```json
{ "sessionId": "sess1", "groupJid": "123@g.us", "command": "!ping" }
```

---

## Health

### GET /health

Public health check. No auth required.

```json
{
  "ok": true,
  "uptime": 3600,
  "version": "2.0.0",
  "sessions": { "total": 1, "connected": 1 },
  "memory": { "rss": "128.4 MB", "heapUsed": "64.2 MB" },
  "throughput": { "messagesReceived": 1024, "commandsExecuted": 88 },
  "activeSockets": 1
}
```

---

## WebSocket

Connect to `ws://host/ws?token=<jwt>`.

After connection, the server sends an initial `runtime:snapshot` event.

### Incoming events (server → client)

| Type | Payload |
|---|---|
| `runtime:snapshot` | Full `RuntimeSnapshot` |
| `session:connected` | `{ sessionId, phoneNumber }` |
| `session:disconnected` | `{ sessionId, reason }` |
| `session:qr` | `{ sessionId, qr }` |
| `session:pairing_code` | `{ sessionId, code }` |
| `session:health_changed` | `{ sessionId, health }` |
| `group:updated` | `{ sessionId, groupJid }` |
| `anti:triggered` | `{ sessionId, groupJid, detectorId, action }` |
| `monitor:snapshot` | Per-session stats |
| `log:line` | `{ line, ts }` |
| `notification` | `{ message }` |

### Outgoing messages (client → server)

| Type | Description |
|---|---|
| `ping` | Server responds with `{ type: "ping", payload: { ts } }` |

---

## Error Responses

All errors follow:

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
