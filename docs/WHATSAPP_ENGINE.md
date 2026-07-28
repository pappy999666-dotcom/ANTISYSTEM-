# PAPPYBOT V2 — WhatsApp Engine Documentation

## Overview

The WhatsApp Engine provides a production-grade, multi-session WhatsApp automation platform
built on `@crysnovax/baileys`. It is designed to be:

- **Lightweight** — minimal memory footprint per session
- **Asynchronous** — fully Promise/async-based
- **Scalable** — N isolated sessions run independently
- **Restart-safe** — credentials are persisted to disk, sessions restore on restart
- **Event-driven** — all cross-module communication goes through the typed EventBus
- **Production-ready** — structured logging, error isolation, reconnection with backoff

---

## Architecture Diagram

```
Bootstrap
  └── App.initialize()
        ├── Config, Cache, Database, Permissions
        ├── SessionManager
        ├── MiddlewareEngine → CommandEngine → ResponseEngine → MessagePipeline
        └── App.startSession(sessionId)
              └── WhatsAppClient
                    ├── SocketManager  (global singleton)
                    ├── AuthManager    (per session)
                    ├── GroupCache     (per session)
                    ├── ContactCache   (per session)
                    ├── SendMessageService
                    ├── MediaEngine
                    └── Baileys socket events
                          ├── connection.update → ConnectionLifecycle
                          ├── messages.upsert → MessageNormalizer → MessagePipeline
                          ├── groups.* → GroupCache + EventBus
                          └── contacts.* → ContactCache + EventBus
```

---

## Session Management

### How sessions are created

```typescript
// In App.startSession():
const sessionManager = container.resolve<SessionManager>('SessionManager');
sessionManager.create({ id: 'default', owner: '15551234567@s.whatsapp.net', settings: {} });

// Then start:
const client = await app.startSession('default');
```

Each session has:
- A unique `sessionId`
- Its own auth directory at `storage/sessions/<sessionId>/`
- Its own `GroupCache`, `ContactCache`, `AuthManager`
- Its own Baileys socket registered in the global `SocketManager`

Sessions never share sockets, caches, or auth state.

---

## Socket Management

**File:** `src/whatsapp/SocketManager.ts`

The `SocketManager` is a **global singleton** (`socketManager`) that acts as the
central registry for all Baileys socket instances.

### Key methods

| Method | Description |
|---|---|
| `setSocket(sessionId, sock)` | Register a socket. Closes existing if duplicate. |
| `getSocket(sessionId)` | Look up a socket (undefined if not present). |
| `requireSocket(sessionId)` | Like `getSocket` but throws if not found. |
| `removeSocket(sessionId)` | Deregister and optionally close the socket. |
| `healthCheck()` | Returns `SocketHealth[]` — connected, readyState, lastActivity. |
| `touchActivity(sessionId)` | Update the last-active timestamp. |

### Why a singleton?

Services (GroupService, SendMessageService, MediaEngine) need to resolve a live
socket by session ID. A global registry avoids threading sockets through every
call, while still keeping sessions isolated at the data level.

---

## Authentication

**File:** `src/whatsapp/AuthManager.ts`

Supports:
- **Multi-file auth state** (`useMultiFileAuthState`) — stored at `storage/sessions/<id>/`
- **QR code flow** — QR is emitted as `session:qr` event and printed to terminal
- **Pairing code flow** — call `client.requestPairingCode(phoneNumber)` after `start()`
- **Session restoration** — if auth files exist, the session reconnects without QR

```typescript
// Check if session has stored auth (can restore):
authManager.hasStoredAuth(sessionId);  // → boolean

// Clear auth for re-pairing:
authManager.clearAuthFiles(sessionId);

// Request pairing code (alternative to QR):
const code = await client.requestPairingCode('15551234567');
// code looks like "AAAA-BBBB"
```

When a session logs out permanently (`DisconnectReason.loggedOut`):
- Auth files are deleted automatically
- A `session:logged_out` event is emitted
- No other session is affected

---

## Connection Lifecycle

All connection states from Baileys are handled in `WhatsAppClient._handleConnectionUpdate()`.

| State | Action |
|---|---|
| QR received | Emit `session:qr`, print to terminal |
| `connection === 'open'` | Update status, emit `session:connected`, reset reconnect counter |
| `connection === 'close'` (transient) | Reconnect with exponential backoff (max 60s) |
| `loggedOut` disconnect | Clear auth, emit `session:logged_out`, stop reconnecting |
| `connectionReplaced` | Emit `session:stream_replaced`, stop reconnecting |
| Max reconnects reached | Log error, stop reconnecting |

### Reconnection backoff

```
delay = min(SESSION_RECONNECT_DELAY_MS × attempt, 60_000)
```

Defined in `src/constants/index.ts`. Default `SESSION_RECONNECT_DELAY_MS = 3000ms`.

---

## Message Normalization

**File:** `src/whatsapp/MessageNormalizer.ts`

Every incoming raw Baileys message is converted to `ExtendedNormalizedMessage`
before any module processes it. **No module should ever inspect raw Baileys payloads.**

### Normalized types

| Baileys message | Normalized `type` |
|---|---|
| `conversation` / `extendedTextMessage` | `text` |
| `imageMessage` | `image` |
| `videoMessage` | `video` |
| `audioMessage` (ptt=false) | `audio` |
| `audioMessage` (ptt=true) | `voice` |
| `documentMessage` | `document` |
| `stickerMessage` | `sticker` |
| `locationMessage` / `liveLocationMessage` | `location` |
| `contactMessage` / `contactsArrayMessage` | `contact` |
| `reactionMessage` | `reaction` |
| `pollCreationMessage` / V2 / V3 | `poll` |
| `buttonsResponseMessage` / `listResponseMessage` | `text` (with `interactiveInfo`) |
| View-once wrappers | unwrapped, `isViewOnce: true` |
| Ephemeral wrappers | unwrapped, `isEphemeral: true` |
| Forwarded messages | any type, `isForwarded: true`, `forwardingScore > 0` |

### Extra fields on `ExtendedNormalizedMessage`

```typescript
interface ExtendedNormalizedMessage extends NormalizedMessage {
  caption?:            string;
  isViewOnce?:         boolean;
  isEphemeral?:        boolean;
  ephemeralExpiration?: number;
  forwardingScore?:    number;
  isForwarded?:        boolean;
  pollInfo?:           { name, options, selectableCount }
  reactionInfo?:       { targetMessageId, emoji }
  locationInfo?:       { latitude, longitude, name?, address?, isLive? }
  contactInfo?:        Array<{ displayName?, vcard }>
  mediaInfo?:          { mimeType?, fileLength?, width?, height?, seconds?, fileName? }
  linkPreview?:        { url?, title?, description? }
  newsletterInfo?:     { newsletterJid?, newsletterName? }
  interactiveInfo?:    { type, selectedButtonId?, selectedRowId? }
}
```

---

## Message Sending Engine

**File:** `src/whatsapp/SendMessageService.ts`

The unified outgoing message service. **All code that sends a WhatsApp message
must use `SendMessageService` or `ResponseEngine` — never call `sock.sendMessage()` directly.**

### Supported message types

```typescript
// Text
await sendService.sendText(sessionId, chatJid, 'Hello!', { mentions: ['...'], linkPreview: false });

// Image / Video / Audio / Voice / Sticker / Document
await sendService.sendImage(sessionId, chatJid, buffer, { caption: '...', viewOnce: true });
await sendService.sendVideo(sessionId, chatJid, buffer, { gifPlayback: true });
await sendService.sendVoiceNote(sessionId, chatJid, buffer);
await sendService.sendDocument(sessionId, chatJid, buffer, 'file.pdf', 'application/pdf');

// Location
await sendService.sendLocation(sessionId, chatJid, lat, lng, { name: 'Place' });

// Contact cards
await sendService.sendContact(sessionId, chatJid, vcard, { displayName: 'John' });

// Poll
await sendService.sendPoll(sessionId, chatJid, 'Question?', [{name:'A'},{name:'B'}]);

// Reaction
await sendService.sendReaction(sessionId, chatJid, messageKey, '👍');

// Quoted reply
await sendService.sendText(sessionId, chatJid, 'Reply!', { quotedMessageId: 'msg-id-123' });

// Presence
await sendService.sendPresence(sessionId, chatJid, 'composing');
```

---

## Media Engine

**File:** `src/whatsapp/MediaEngine.ts`

### Download

```typescript
const buffer = await mediaEngine.downloadMedia(sessionId, rawMessage, {
  maxSizeBytes: 16 * 1024 * 1024,
  saveTo: '/tmp/downloaded.jpg', // optional
});
```

### Temp file management

```typescript
const tempPath = mediaEngine.saveTempFile(buffer, 'jpg');
// ... use the file ...
mediaEngine.removeTempFile(tempPath);

// Or clean all tracked temp files at once:
mediaEngine.cleanupTempFiles();

// Clean files older than 10 minutes:
mediaEngine.cleanupOlderThan(10 * 60 * 1000);
```

### MIME & type detection

```typescript
const mimeType = mediaEngine.detectMimeType(buffer);  // → 'image/jpeg'
const type     = mediaEngine.mimeToMediaType(mimeType); // → 'image'
const info     = mediaEngine.inspectBuffer(buffer, 'photo.jpg');
// info: { mimeType, type, size, fileName }
```

---

## Group Service Layer

**File:** `src/services/GroupService.ts`

```typescript
// Metadata (cached, auto-refreshes)
const meta = await groupService.getMetadata(sessionId, groupJid);

// Create / leave
const newGroupJid = await groupService.createGroup(sessionId, { subject: 'Test', participants: ['...'] });
await groupService.leaveGroup(sessionId, groupJid);

// Update group
await groupService.updateSubject(sessionId, groupJid, 'New Name');
await groupService.updateDescription(sessionId, groupJid, 'Description');
await groupService.updateGroupPicture(sessionId, groupJid, imageBuffer);

// Participants
await groupService.updateParticipants(sessionId, groupJid, 'add', ['15551234567@s.whatsapp.net']);
await groupService.updateParticipants(sessionId, groupJid, 'promote', ['...']);

// Settings
await groupService.setAnnounce(sessionId, groupJid, true);  // only admins can send
await groupService.setRestrict(sessionId, groupJid, true);  // only admins edit info
await groupService.setDisappearingMessages(sessionId, groupJid, 604800); // 7 days

// Invite
const code = await groupService.getInviteCode(sessionId, groupJid);
await groupService.revokeInviteCode(sessionId, groupJid);
const joinedJid = await groupService.acceptInvite(sessionId, inviteCode);
```

---

## Contact Service Layer

**File:** `src/services/ContactService.ts`

```typescript
// Cached info
const contact = contactService.getCached(jid);
const name    = contactService.getDisplayName(jid);

// Profile data (live fetch)
const profile = await contactService.getProfile(sessionId, jid);
// profile: { jid, pushName, statusText, profilePictureUrl }

// Block list
const blocked = await contactService.getBlockList(sessionId);
await contactService.updateBlock(sessionId, jid, 'block');
await contactService.updateBlock(sessionId, jid, 'unblock');
```

---

## Profile Service Layer

**File:** `src/services/ProfileService.ts`

```typescript
// Own profile
const own = await profileService.getOwnProfile(sessionId);

// Profile picture
const url = await profileService.fetchProfilePicture(sessionId, jid, /* hq= */ true);
await profileService.updateProfilePicture(sessionId, jpegBuffer);

// Name / status
await profileService.updateProfileName(sessionId, 'PappyBot');
await profileService.updateStatus(sessionId, 'Powered by PAPPYBOT V2');

// Check registration
const exists = await profileService.isOnWhatsApp(sessionId, '15551234567');
```

---

## Permission Helpers

**File:** `src/whatsapp/PermissionHelpers.ts`

```typescript
const ctx: PermissionContext = { message, ownerJid, sudoJids, groupCache, botJid };

PermissionHelpers.isGroup(ctx);         // chatType === 'group'
PermissionHelpers.isPrivate(ctx);       // chatType === 'private'
PermissionHelpers.isAdmin(ctx);         // sender is group admin
PermissionHelpers.isSuperAdmin(ctx);    // sender is group creator
PermissionHelpers.isOwner(ctx);         // sender === global owner
PermissionHelpers.isSudo(ctx);          // isOwner OR in sudoJids
PermissionHelpers.isBotAdmin(ctx);      // bot account is admin in the group
PermissionHelpers.isSessionOwner(ctx);  // sender === bot account JID
PermissionHelpers.resolveLevel(ctx);    // → 'GLOBAL_OWNER' | 'SESSION_OWNER' | 'SUDO' | 'ADMIN' | 'USER'
```

---

## Caching Strategy

### GroupCache (`src/whatsapp/GroupCache.ts`)

- **TTL:** 5 minutes (configurable via constructor)
- **Storage:** in-memory Map per session
- **Invalidation:** on `groups.update` events (auto-patched), on leave, and explicit `invalidate(jid)`
- **Prune:** call `groupCache.prune()` periodically to evict stale entries

### ContactCache (`src/whatsapp/ContactCache.ts`)

- **TTL:** 30 minutes (configurable via constructor)
- **Storage:** in-memory Map per session
- **Updates:** from `contacts.upsert`, `contacts.update`, and `pushName` in incoming messages
- **Prune:** call `contactCache.prune()` periodically

Both caches are cleared on `WhatsAppClient.stop()`.

---

## Internal Events

All cross-module communication uses the typed `EventBus`. Subscribe to events
without importing or modifying the WhatsApp core.

```typescript
eventBus.on('session:connected', ({ sessionId, phoneNumber }) => { ... });
eventBus.on('session:disconnected', ({ sessionId, reason }) => { ... });
eventBus.on('session:logged_out', ({ sessionId }) => { ... });
eventBus.on('message:received', ({ message }) => { ... });      // ExtendedNormalizedMessage
eventBus.on('message:sent', ({ messageId, sessionId }) => { ... });
eventBus.on('group:updated', ({ sessionId, groupJid }) => { ... });
eventBus.on('group:participant_added', ({ sessionId, groupJid, jid }) => { ... });
eventBus.on('contact:upserted', ({ sessionId, jid }) => { ... });
eventBus.on('media:downloaded', ({ sessionId, type, messageId }) => { ... });
eventBus.on('call:incoming', ({ sessionId, callId, callerJid }) => { ... });
eventBus.on('monitor:snapshot', ({ sessionId, stats }) => { ... });
```

Full event type reference: `src/types/Events.ts`

---

## Runtime Monitor

**File:** `src/services/RuntimeMonitor.ts`

```typescript
const monitor = new RuntimeMonitor(socketManager, sessionManager, cacheManager, eventBus);
monitor.start(); // begins emitting monitor:snapshot every 60s

// Get current snapshot programmatically:
const snap = monitor.snapshot();
// snap: { capturedAt, sessions[], memory, throughput, totalReconnects, activeSockets }

// Human-readable summary:
console.log(monitor.getSummary());

// Stop when shutting down:
monitor.stop();
```

The `monitor:snapshot` event feeds the future Telegram panel and Web dashboard.

---

## Adding New Features (Extension Points)

### New Baileys event handler

Add to `WhatsAppClient._registerBaileysEvents()`:

```typescript
sock.ev.on('your-new-event', async (data: unknown) => {
  // normalize data, update cache if needed, emit on bus
  await this.bus.emit('your:internal:event', { sessionId: this.sessionId, ...normalized });
});
```

### New service

1. Create `src/services/YourService.ts` extending `BaseService`
2. Accept `SocketManager` (and any cache) in the constructor
3. Register in `App.initialize()`
4. Subscribe to relevant events via `EventBus`
5. Never call `sock` directly — use `socketManager.requireSocket(sessionId)`

### New message type

Add a branch to `MessageNormalizer.extractContent()`:

```typescript
if (message['yourNewMessageType']) {
  const m = message['yourNewMessageType'] as Record<string, unknown>;
  return { type: 'text', text: null, extra: { /* ... */ } };
}
```

Baileys event handlers and future modules automatically receive the normalized form.

## Prompt 2 lifecycle and event expansion

The WhatsApp client exposes a small `WhatsAppClientOptions` object for supported
Baileys browser profiles (`linux`, `macOS`, `ubuntu`, `chrome`, `firefox`, and
`safari`) and an authentication-flow hint for QR or pairing-code based pairing.
These options are passed only through documented Baileys socket configuration and
are not used to spoof unsupported clients or bypass WhatsApp protections.

The lifecycle now emits typed internal events for each significant transition:

| Event | Purpose |
|---|---|
| `session:connecting` | Socket creation or Baileys `connecting` update started. |
| `session:connection_update` | Raw connection state, reason, and status code surfaced for observability. |
| `session:retry_required` | A transient disconnect will be retried after a bounded backoff. |
| `session:restart_required` | Baileys requested a socket restart through `DisconnectReason.restartRequired`. |
| `session:logged_out` | Permanent logout; only that session's auth/runtime state is purged. |
| `session:stream_replaced` | Another stream replaced this socket; reconnect is intentionally stopped. |

Additional event registry coverage is available for message history sync,
poll updates, newsletter/channel updates, status updates, group join approvals,
and profile name updates. Future modules should subscribe to these typed events
instead of adding direct Baileys listeners unless they are extending the core
registry itself.
