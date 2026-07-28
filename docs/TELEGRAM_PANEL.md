# Telegram Control Panel

Premium Telegram-based dashboard for managing PAPPYBOT V2 WhatsApp sessions and groups.

---

## Architecture

```
TelegramBot (orchestrator)
  ├── Middleware: authGuard → forceJoinCheck → registrationGate
  ├── Handlers
  │     ├── RegistrationHandler   — /start, name, domain onboarding
  │     ├── DashboardHandler      — main dashboard, /dashboard command
  │     ├── SessionHandler        — list, open, rename, reconnect, logout, delete, pair
  │     ├── GroupHandler          — discovery, dashboard, bridge mode, participants
  │     ├── SettingsHandler       — notifications, domain, prefix, export, import
  │     ├── OwnerHandler          — users, broadcast, ban/unban, stats, maintenance, force join
  │     ├── LogsHandler           — live log viewer (ring buffer)
  │     └── BridgeHandler         — Telegram → WhatsApp message forwarding
  ├── Services
  │     ├── NotificationService   — EventBus → Telegram push notifications
  │     └── BroadcastService      — bulk message delivery with stats
  └── Core
        ├── TelegramStore         — in-memory + JSON persistence
        └── CallbackRouter        — 64-byte callback_data encode/decode
```

---

## Setup

1. Create a bot via [@BotFather](https://t.me/BotFather) and get the token.
2. Get your Telegram user ID (e.g. via [@userinfobot](https://t.me/userinfobot)).
3. Set environment variables:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_OWNER_ID=your_telegram_user_id
```

4. Start the app — the panel starts automatically if `TELEGRAM_BOT_TOKEN` is set.

---

## User Registration Flow

```
/start
  → Welcome screen
  → Send display name
  → Send domain (or /skip)
  → Port allocated
  → Dashboard shown
```

Each user receives an isolated port starting from 2001. Ports are never reused until explicitly released.

---

## Dashboard

Shows live stats:
- Connected / disconnected / total sessions
- Memory usage
- Message throughput
- Command stats

Buttons: Pair Session · Sessions · Groups · Settings · Logs · Refresh · Support · Owner

---

## Session Management

| Action | Description |
|---|---|
| Open | View session card with status, phone, uptime |
| Rename | Change session label |
| Reconnect | Restart WhatsApp connection |
| Logout | Disconnect and remove session |
| Delete | Permanently delete session |
| Settings | View session config (AI placeholder included) |

### Pairing Flow

```
Pair Session → Enter session name → Choose method:
  ├── Pairing Code → Display code → Wait for connection
  └── QR Code     → Display QR   → Auto-refresh on expiry
```

Connection events (Connecting, Authenticating, Connected, Disconnected) are pushed as Telegram notifications automatically.

---

## Group Discovery

- Lists all groups from the shared GroupCache
- Admin groups highlighted with 👑
- Paginated (8 per page)
- Sortable/filterable via search (future)

---

## Group Dashboard

Per-group panel showing:
- Name, description, member count, admin count
- JID

Buttons: Open Bridge · Settings · Participants · Welcome · Templates · Refresh · Back

---

## Bridge Mode

Activating bridge mode routes all Telegram messages to the selected WhatsApp group:

| Telegram message type | WhatsApp equivalent |
|---|---|
| Text | Text message |
| Photo | Image with caption |
| Video | Video with caption |
| Voice | PTT voice note |
| Audio | Audio file |
| Document | Document |
| Sticker | Sticker |

Reactions (👍) confirm successful delivery. Exit bridge with the Exit Bridge button.

---

## Live Logs

Ring buffer of the last 30 log lines. Auto-refreshes on button press. Shows:
- Session connect/disconnect events
- Commands executed
- Command errors
- Anti system triggers

---

## Settings Panel

| Setting | Description |
|---|---|
| Notifications | Toggle push notifications on/off |
| Domain | Update base URL for Intro Card system |
| Prefix | Change command prefix |
| Export | Export config as JSON (no secrets) |
| Import | Import previously exported config |

---

## Owner Panel

Accessible only to `TELEGRAM_OWNER_ID`.

| Feature | Description |
|---|---|
| Users | List all registered users with status |
| Broadcast | Send text/media to all users |
| Ban/Unban | Block or restore user access |
| Stats | Full runtime metrics snapshot |
| Maintenance | Toggle maintenance mode |
| Announce | Send announcement to all users |
| Force Join | Require channel membership before access |

---

## Force Join System

When enabled, users must be members of all configured channels/groups before using the bot.

```
Owner Panel → Force Join → Enable → Add Chat → @channelname
```

The bot checks membership on every interaction. Friendly error message shown if not joined.

---

## Broadcast Engine

Supports: Text · Photo · Video · Audio · Voice · Document

- Delivery tracked per user
- 50ms delay between sends (flood protection)
- Stats: Delivered / Failed / Skipped / Total
- Cancellable

---

## Notification Engine

Automatic push notifications for:

| Event | Notification |
|---|---|
| Session connected | 🟢 WhatsApp Connected |
| Session disconnected | 🔴 WhatsApp Disconnected |
| Session logged out | ⚫ Session Logged Out |
| Session error | ❌ Session Error |
| User banned (anti) | 🚫 User Banned |
| Warning issued | ⚠️ Warning Issued |
| Group created | ✅ Group Created |

Only sent to users with `notificationsEnabled: true` who own the affected session.

---

## Port Allocation

Each user gets a unique port starting from 2001:

```
User 1 → Port 2001
User 2 → Port 2002
User 3 → Port 2003
...
```

Ports are persisted in `storage/telegram_store.json`. Released ports become reusable.

---

## Permission Model

| Level | Access |
|---|---|
| Unregistered | /start only |
| Registered user | Own sessions, own groups, own settings |
| Global Owner (`TELEGRAM_OWNER_ID`) | All users, all sessions, owner panel |
| Banned user | Blocked entirely |

---

## Data Persistence

State is stored in `storage/telegram_store.json`:
- User registrations
- Port allocations
- VPS config
- Force join config
- Broadcast history

Authentication secrets are never stored or exported.

---

## Extension Points

- Swap `TelegramStore` backing to `DatabaseManager` for multi-instance support
- Add Redis session state for horizontal scaling
- Implement search across groups/sessions/users
- Add theme support (placeholder in settings)
- Wire AI assistant settings when Prompt 7 is implemented
- Add Intro Card URL button system when IntroCardService is completed
