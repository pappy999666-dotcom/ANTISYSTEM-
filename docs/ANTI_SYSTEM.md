# PAPPYBOT V2 — Anti System Documentation

## Overview

The Anti System is a modular, event-driven engine that protects WhatsApp groups
from unwanted content. It is built on a set of reusable sub-engines — no
business logic is duplicated across features.

```
src/anti/
  core/
    AntiEngine.ts       — central orchestrator
    DetectorEngine.ts   — plugin-based detector framework
    ActionEngine.ts     — reusable action executor
    PermitEngine.ts     — shared permit/whitelist system
    RuleEngine.ts       — rule evaluation
    ConfigManager.ts    — per-group O(1) config store
    AuditLogger.ts      — structured audit records
    StatsManager.ts     — runtime metrics
    TemplateEngine.ts   — variable-substitution messages
    AntiMiddleware.ts   — MiddlewareEngine integration
  detectors/
    LinkDetector.ts
    BotDetector.ts
    SpamDetector.ts
    MediaDetectors.ts   — picture, video, audio, voice, sticker, document
    SimpleDetectors.ts  — text, emoji, poll, forward, channel, groupcall
    WordFilterDetector.ts
    NsfwDetector.ts
  services/
    WarnService.ts
    BanService.ts
  types/
    Anti.ts
```

---

## Message Inspection Pipeline

Every incoming group message flows through:

```
WhatsAppClient (messages.upsert)
  → MessageNormalizer
  → MessagePipeline
    → MiddlewareEngine
      → LoggingMiddleware (priority 900)
      → MaintenanceMiddleware (priority 800)
      → RateLimitMiddleware (priority 700)
      → AntiMiddleware (priority 500)   ← Anti System entry point
        → AntiEngine.inspect()
          → BanService.isBanned()       ← immediate delete if banned
          → DetectorEngine.runAll()     ← all enabled detectors in parallel
          → RuleEngine.evaluateAll()    ← match results to rules
          → PermitEngine.isPermitted()  ← bypass check per detector
          → ActionEngine.execute()      ← delete / warn / kick / ban
          → AuditLogger.record()
          → StatsManager.record*()
          → EventBus.emit('anti:triggered')
      → CommandEngine (priority 0)
```

---

## Detector Lifecycle

1. Registered once via `DetectorEngine.register(detector)`
2. Stateless — per-group settings passed at runtime
3. Run in parallel via `Promise.all`
4. Return `DetectionResult` — never throw
5. `matched: false` = no action taken

### Adding a new detector

```typescript
import { BaseDetector } from '@anti/core/DetectorEngine';
import { matchResult, noMatch } from '@anti/core/DetectorEngine';

export class MyDetector implements BaseDetector {
  readonly id = 'mydetector';

  async detect(message, settings): Promise<DetectionResult> {
    const start = Date.now();
    if (/* your condition */) {
      return matchResult('mydetector', Date.now() - start, {
        confidence: 1,
        reason: 'My reason',
        metadata: { /* ... */ },
      });
    }
    return noMatch('mydetector', Date.now() - start);
  }
}

// Register in AntiEngine.registerAllDetectors():
this.detectors.register(new MyDetector());
```

---

## Action Lifecycle

Actions are executed by `ActionEngine.execute(ctx)`.

| Action | Behavior |
|---|---|
| `delete` | Delete the offending message via `sock.sendMessage({ delete: key })` |
| `warn` | Add warn via WarnService, send warn message, auto-kick at limit |
| `kick` | Remove participant via `sock.groupParticipantsUpdate(..., 'remove')` |
| `delete+warn` | delete → warn |
| `delete+kick` | delete → kick |
| `ban` | BanService.ban() + kick |
| `ignore` | No-op |
| `log` | Audit log only |
| `mute` | Future-ready placeholder |
| `custom` | Calls `rule.customCallback(ctx)` |

---

## Permit Lifecycle

Permits exempt users from specific detectors in specific groups.

```typescript
// Add a permit
antiEngine.permits.add({
  jid: '15551234567@s.whatsapp.net',
  detectorId: 'link',          // or '*' for all detectors
  groupJid: '120363...@g.us',  // or '*' for all groups
  sessionId: 'default',
  grantedBy: ownerJid,
  reason: 'Trusted admin',
});

// Remove a permit
antiEngine.permits.remove(sessionId, groupJid, jid, 'link');

// Remove all permits for a user in a group
antiEngine.permits.removeAll(sessionId, groupJid, jid);

// Check
antiEngine.permits.isPermitted({ sessionId, groupJid, senderJid, detectorId, ... });
```

Bypass hierarchy (any match = permitted):
1. Global owner JID
2. Bot JID (session account)
3. Sudo JIDs
4. Group admins (if `adminBypass: true` in detector settings)
5. Explicit permit record (with optional expiry)

---

## Group Configuration

Every group has independent configuration. Changes in one group never affect another.

```typescript
const cfg = antiEngine.config;

// Enable AntiLink in a group
cfg.setEnabled(sessionId, groupJid, 'link', true);

// Set action
cfg.setAction(sessionId, groupJid, 'link', 'delete+warn');

// Detector-specific settings
cfg.setSetting(sessionId, groupJid, 'link', 'allowedDomains', ['example.com']);
cfg.setSetting(sessionId, groupJid, 'spam', 'limit', 10);
cfg.setSetting(sessionId, groupJid, 'spam', 'windowMs', 5000);
cfg.setSetting(sessionId, groupJid, 'emoji', 'threshold', 5);
cfg.setSetting(sessionId, groupJid, 'bot', 'threshold', 0.6);

// Warn limit
cfg.setWarnLimit(sessionId, groupJid, 3);

// Custom message template
cfg.setTemplate(sessionId, groupJid, 'link', '⚠️ @mention, no links allowed!');
```

---

## Detectors Reference

| Detector ID | Triggers on | Key settings |
|---|---|---|
| `link` | URLs in text/caption/quoted/preview | `allowedDomains`, `allowInvites`, `checkQuoted` |
| `bot` | Bot-like signals (confidence-based) | `threshold` (default 0.6) |
| `spam` | Message burst / repeated messages | `limit`, `windowMs`, `repeatThreshold` |
| `picture` | Image messages | — |
| `video` | Video messages | — |
| `audio` | Audio messages | — |
| `voice` | Voice note messages | — |
| `sticker` | Sticker messages | — |
| `document` | Document messages (future-ready) | — |
| `text` | Plain text messages | — |
| `emoji` | Emoji in messages | `threshold` (1 = any emoji) |
| `poll` | Poll creation messages | — |
| `forward` | Forwarded messages | `minForwardingScore` (default 1) |
| `channel` | Newsletter/channel messages | — |
| `groupcall` | Call events (via EventBus) | — |
| `words` | Banned words/phrases | `words[]`, `mode`, `caseSensitive`, `categories` |
| `nsfw` | NSFW images (external API) | `provider`, `apiKey`, `threshold` |

---

## Warn System

```typescript
// Add warn (returns { count, limit, record })
const { count, limit } = await antiEngine.warns.addWarn({
  sessionId, groupJid, userJid, reason, moderatorJid,
});

// Remove last warn
await antiEngine.warns.removeWarn(sessionId, groupJid, userJid);

// Reset all warns
await antiEngine.warns.resetWarns(sessionId, groupJid, userJid);

// Query
antiEngine.warns.getCount(sessionId, groupJid, userJid);
antiEngine.warns.getHistory(sessionId, groupJid, userJid);
antiEngine.warns.getAllInGroup(sessionId, groupJid);
```

Auto-kick fires when `count >= warnLimit` (configurable per group, default: 3).

---

## Ban System

```typescript
// Ban
await antiEngine.bans.ban({ sessionId, groupJid, userJid, reason, moderatorJid, permanent: true });

// Unban
await antiEngine.bans.unban(sessionId, groupJid, userJid);

// Check
antiEngine.bans.isBanned(sessionId, groupJid, userJid);

// List
antiEngine.bans.getBannedInGroup(sessionId, groupJid);
```

Banned users have all future messages deleted immediately on arrival.

---

## Template Engine

```typescript
// Built-in template keys: link, warn, kick, spam, bot, picture, video,
// audio, voice, sticker, text, emoji, poll, forward, channel, words, nsfw

// Override a template
antiEngine.templates.set('link', '🚫 @mention — links are banned here! (&gcname)');

// Variables: @mention, &sender, &gcname, &count, &warn, &limit,
//            &reason, &detector, &action, &time, &date
// Unknown variables are left as-is (safe).
```

---

## NSFW Provider

```typescript
import { registerNsfwProvider, type NsfwProvider } from '@anti/detectors/NsfwDetector';

const mySightengineProvider: NsfwProvider = {
  id: 'sightengine',
  async scan(buffer, apiKey, apiSecret, timeoutMs) {
    // Call Sightengine API with buffer
    return { isNsfw: false, confidence: 0, categories: [] };
  },
};

registerNsfwProvider(mySightengineProvider);
```

Configure per group:
```typescript
cfg.setSetting(sessionId, groupJid, 'nsfw', 'provider', 'sightengine');
cfg.setSetting(sessionId, groupJid, 'nsfw', 'apiKey', 'your-key');
cfg.setSetting(sessionId, groupJid, 'nsfw', 'threshold', 0.7);
```

---

## Internal Events

```typescript
eventBus.on('anti:triggered',      ({ sessionId, groupJid, senderJid, detectorId, action, reason }) => {});
eventBus.on('anti:message_deleted',({ sessionId, groupJid, messageId, reason }) => {});
eventBus.on('anti:user_kicked',    ({ sessionId, groupJid, userJid, reason }) => {});
eventBus.on('anti:user_banned',    ({ sessionId, groupJid, userJid, reason }) => {});
eventBus.on('anti:user_unbanned',  ({ sessionId, groupJid, userJid }) => {});
eventBus.on('anti:warn_added',     ({ sessionId, groupJid, userJid, count, limit, reason }) => {});
eventBus.on('anti:warn_removed',   ({ sessionId, groupJid, userJid, count }) => {});
eventBus.on('anti:permit_added',   ({ sessionId, groupJid, userJid, detectorId }) => {});
eventBus.on('anti:permit_removed', ({ sessionId, groupJid, userJid, detectorId }) => {});
eventBus.on('anti:config_changed', ({ sessionId, groupJid, detectorId, key, oldValue, newValue }) => {});
```

---

## Limitations

- **GroupCall detection**: `@crysnovax/baileys` surfaces calls via the `call` socket event,
  not as regular messages. The AntiEngine subscribes to `call:incoming` on the EventBus
  and routes it through the `groupcall` detector. Full group call interception depends
  on what the library exposes at runtime.

- **GroupStatusMention**: Not currently exposed as a distinct message type by the library.
  The detector framework is ready — add a detector when the library exposes this event.

- **NSFW video scanning**: The NsfwDetector interface supports video via the same
  `NsfwProvider.scan()` contract. Enable by checking `message.type === 'video'`
  in a custom provider implementation.

- **Encrypted content**: The library does not expose encrypted message content.
  Detection operates only on decrypted, client-visible data.

- **Message deletion**: Deletion requires the bot to be a group admin.
  Non-admin bots cannot delete other users' messages.
