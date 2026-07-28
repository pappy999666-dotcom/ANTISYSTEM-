# PAPPYBOT V2 — Session Lifecycle & Pairing Engine

## Architecture

```
PairingEngine → WhatsAppClient → ConnectionManager
     ↓                ↓                ↓
HeartbeatMonitor  AuthManager    ReconnectEngine
     ↓                ↓
SessionHealthService  CleanupEngine
```

---

## Pairing Flow

```
User (Telegram / Web)
  → Choose session name
  → Select method: QR | Pairing Code
  → (Code only) Send phone number
  → PairingEngine.pair()
      → SessionManager.create()
      → HeartbeatMonitor.register()
      → App.startSession()
          → WhatsAppClient.start()
              → AuthManager.loadAuthState()
              → makeWASocket()
              → SocketManager.setSocket()
      → (Code) socket.requestPairingCode(phone, customCode?)
  → EventBus emits: session:pairing_status, session:qr / session:pairing_code
  → User scans QR or enters code in WhatsApp
  → connection.update → 'open'
  → EventBus emits: session:connected, session:pair_completed
  → NotificationService → Telegram push
  → WsServer → Web dashboard realtime update
```

---

## Pairing Methods

### QR Code
- Default method. No phone number required.
- QR string emitted via `session:qr` event.
- Rendered in terminal (qrcode-terminal) and forwarded to Telegram/Web.

### Pairing Code
- Phone number required in E.164 format without `+` (e.g. `15551234567`).
- Calls `socket.requestPairingCode(phone, customCode?)`.
- Code emitted via `session:pairing_code` event.

### Custom Pairing Code
- Supported by `@crysnovax/baileys` via second argument to `requestPairingCode`.
- **Must be exactly 8 characters.** Shorter or longer codes are rejected by the library.
- Set via `PAIRING_CODE` env var or `customCode` field in API request.
- Falls back to random code if not provided or invalid length.

---

## Authentication Storage

- Uses `useMultiFileAuthState` from `@crysnovax/baileys`.
- Files stored at `storage/sessions/<sessionId>/`.
- Credentials auto-saved on every `creds.update` event.
- Survives: application restart, server reboot, process restart, network interruption.
- Auth is only cleared on intentional logout or session delete.

---

## Connection Manager

Handles all connection state transitions. Prevents duplicate reconnect loops.

| State | Description |
|---|---|
| `connecting` | Socket being created |
| `qr_pending` | Waiting for QR scan |
| `connected` | Session active |
| `disconnected` | Temporary disconnect |
| `reconnecting` | Backoff reconnect in progress |
| `logged_out` | Permanent — no reconnect |
| `stream_replaced` | Another device connected — no reconnect |
| `error` | Max retries exceeded |
| `destroyed` | Session fully deleted |

Intentional stops (logout, delete) are tracked in a Set — reconnect engine skips them.

---

## Reconnect Strategy

- Exponential backoff: `min(5000 * 2^(attempt-1), 60000)ms`
- ±10% jitter to prevent thundering herd
- Maximum attempts: `SESSION_MAX_RECONNECT_ATTEMPTS` (default: 10)
- On max exceeded: status → `error`, event `session:reconnect_failed` emitted
- Manual reconnect resets counter and clears intentional stop flag

---

## Heartbeat Monitor

Runs every 30 seconds. Per session:
- Checks socket `ws.readyState === 1` (OPEN)
- Marks session stale if no activity for 90 seconds
- Increments `missedHeartbeats` counter
- Emits `session:health_changed` on stale/recovery transitions

---

## Session Health Score (0–100)

| Condition | Deduction |
|---|---|
| Status: `logged_out` / `banned` | Score = 0 |
| Status: `error` | Score = 10 |
| Status: `disconnected` | Score = 20 |
| Status: `reconnecting` | Score = 40 |
| Status: `connecting` / `qr_pending` | Score = 60 |
| Each missed heartbeat | −15 (max −40) |
| Each reconnect attempt | −5 (max −30) |
| Socket unhealthy | −20 |

---

## Logout vs Delete

### Logout
- Disconnects socket
- Clears runtime memory, cache, scheduler jobs, heartbeat
- **Preserves auth files** — session can be re-paired without re-scanning
- Emits `session:logged_out`

### Delete
- Everything in logout, plus:
- **Deletes auth files** from disk
- **Deletes session storage directory** (media-tmp, logs, etc.)
- Removes from session registry
- Emits `session:deleted`
- Operation is atomic — all steps run before returning

---

## Socket Cleanup

`SocketManager` prevents:
- Duplicate sockets: old socket closed before new one registered
- Zombie sockets: `sock.end()` called on removal
- Listener leaks: all Baileys event handlers attached once per socket creation

`CleanupEngine` prevents:
- Orphan scheduler jobs: cancelled by session prefix
- Orphan cache entries: cleared by namespace prefix
- Orphan heartbeat records: unregistered on cleanup

---

## Events

| Event | Payload |
|---|---|
| `session:pair_started` | `{ sessionId, method }` |
| `session:pairing_status` | `{ sessionId, status }` |
| `session:qr` | `{ sessionId, qr }` |
| `session:pairing_code` | `{ sessionId, code }` |
| `session:pair_completed` | `{ sessionId }` |
| `session:pair_failed` | `{ sessionId, error }` |
| `session:connected` | `{ sessionId, phoneNumber }` |
| `session:disconnected` | `{ sessionId, reason }` |
| `session:reconnect_started` | `{ sessionId, attempt, delayMs }` |
| `session:reconnect_completed` | `{ sessionId, attempt }` |
| `session:reconnect_failed` | `{ sessionId, attempts }` |
| `session:logged_out` | `{ sessionId }` |
| `session:deleted` | `{ sessionId }` |
| `session:health_changed` | `{ sessionId, healthy, reason }` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sessions` | List all sessions |
| `GET` | `/api/sessions/metrics` | Global pairing metrics |
| `GET` | `/api/sessions/:id` | Session detail |
| `GET` | `/api/sessions/:id/health` | Health snapshot |
| `POST` | `/api/sessions` | Create + pair (`method: qr\|code`) |
| `POST` | `/api/sessions/:id/reconnect` | Manual reconnect |
| `POST` | `/api/sessions/:id/logout` | Logout (preserve auth) |
| `DELETE` | `/api/sessions/:id` | Delete permanently |
| `PATCH` | `/api/sessions/:id` | Update label/prefix |

---

## Limitations

- **Custom pairing code must be exactly 8 characters.** This is enforced by `@crysnovax/baileys`. Codes of any other length are rejected.
- **QR codes cannot be rendered as images via Telegram** — the raw QR string is sent as text. Use the web dashboard for visual QR rendering.
- **WhatsApp Web multi-device** allows up to 4 linked devices per account. Exceeding this limit causes `connectionReplaced` disconnect.
- **Pairing code expiry** is controlled by WhatsApp servers, not the bot. If the code expires before entry, restart the pairing flow.
