# Group Status Engine (GStatus)

Complete WhatsApp Status (Stories) engine for PAPPYBOT V2.
Built on `@crysnovax/baileys`. Auto-loaded as a plugin at step 17.

---

## Architecture

```
GStatusPlugin (plugin entry point)
  └── StatusEngine (orchestrator)
        ├── StatusQueue           — per-session priority queue
        ├── RetryManager          — exponential backoff retry logic
        ├── MediaPreparationService — payload builder + link preview
        └── StatusMetricsManager  — per-session metrics

Commands:
  .gstatus   — post content to status@broadcast
  .togstatus — forward content to a target WhatsApp group
```

---

## How WhatsApp Status Works (Baileys)

WhatsApp Status (Stories) are sent to the special JID `status@broadcast`
using the standard `sock.sendMessage()` API. Baileys handles the routing.

Verified via `isJidStatusBroadcast('status@broadcast') === true`.
Status expiry: `STATUS_EXPIRY_SECONDS = 86400` (24 hours).

---

## Supported Content Types

| Type | Supported | Notes |
|---|---|---|
| Text | ✅ | Up to 700 characters, background color, font |
| Image + Caption | ✅ | Max 5 MB |
| Video + Caption | ✅ | Max 16 MB |
| Audio / Voice Note | ✅ | PTT format, ogg/opus |
| Sticker | ✅ | Max 500 KB |
| Document | ✅ | Max 100 MB |
| GIF (video + gifPlayback) | ✅ | Max 16 MB |
| Link Preview (reuse) | ✅ | Preserves existing hydrated preview |
| Link Preview (generate) | ✅ | Via `generateLinkPreviewIfRequired` |
| Polls | ❌ | Not supported by WhatsApp protocol for status |
| Location | ❌ | Not supported in status |
| Contact cards | ❌ | Not supported in status |
| Interactive buttons | ❌ | Not supported in status |

---

## Commands

### `.gstatus`

Post content to WhatsApp Status.

```
.gstatus Hello world!              — text status
.gstatus                           — reply to any message to post it
.gstatus My caption                — reply to media with caption
```

**Quoted message support:**
- Quoted text → text status (with link preview if URL present)
- Quoted image → image status
- Quoted video → video status (or GIF if gifPlayback=true)
- Quoted audio/voice → audio status
- Quoted sticker → sticker status
- Quoted document → document status
- Quoted message with hydrated link preview → preview reused as-is (Mode 1)

**Aliases:** `status`, `poststatus`
**Required role:** SESSION_OWNER

---

### `.togstatus`

Send status content to a target WhatsApp group.

```
.togstatus 1234567890-group@g.us Hello!
.togstatus https://chat.whatsapp.com/ABC123   (reply to media)
```

Accepts:
- Group JID directly
- WhatsApp invite link (resolved via `groupGetInviteInfo`)
- Quoted message (media or text)
- Direct text argument

Target validation:
- Group must exist (checked via GroupCache or live fetch)
- Bot must be a member
- Session must be connected

**Aliases:** `sendtostatus`, `tostatus`
**Required role:** SESSION_OWNER

---

## Link Preview Modes

### Mode 1 — Reuse Existing Preview
If the quoted message contains a hydrated WhatsApp link preview
(`canonicalUrl`, `matchedText`, `jpegThumbnail`, etc.), it is preserved
and sent unchanged. No regeneration occurs.

### Mode 2 — Generate Preview
If the text contains a raw URL and `generateLinkPreviewIfRequired` is
available from Baileys, a preview is generated via `sock.getUrlInfo`.

### Fallback
If preview generation fails or is unavailable, the message is sent
as plain text without a preview. No fabricated previews.

---

## Status Queue

One queue per session. Items are processed sequentially (1 concurrent send)
to respect WhatsApp rate limits.

| Feature | Detail |
|---|---|
| Priority | Higher priority items processed first |
| Deduplication | Each item has a unique UUID |
| Cancellation | `statusEngine.cancel(sessionId, statusId)` |
| Auto-prune | Completed/failed items pruned after 5 minutes |
| Send delay | 1500ms between sends (configurable) |

---

## Retry Manager

Exponential backoff with jitter. Permanent errors are not retried.

| Config | Default |
|---|---|
| Max retries | 3 |
| Base backoff | 2000ms |
| Max backoff | 30000ms |
| Jitter | ±10% |

**Permanent errors (not retried):** not-authorized, forbidden, invalid jid,
bad request, not found, logged out, connection closed, stream errored.

**Transient errors (retried):** network timeouts, temporary failures.

---

## Events Emitted

| Event | Payload |
|---|---|
| `status:queued` | `{ sessionId, statusId, contentType }` |
| `status:started` | `{ sessionId, statusId, contentType, attempt }` |
| `status:completed` | `{ sessionId, statusId, messageId, contentType, durationMs }` |
| `status:failed` | `{ sessionId, statusId, error, attempts }` |
| `status:retry` | `{ sessionId, statusId, attempt, backoffMs, error }` |
| `status:cancelled` | `{ sessionId, statusId }` |
| `status:preview_reused` | `{ sessionId, statusId }` |
| `status:preview_generated` | `{ sessionId, statusId }` |
| `status:media_prepared` | `{ sessionId, statusId, contentType }` |
| `status:queue_finished` | `{ sessionId }` |
| `status:togstatus_sent` | `{ sessionId, groupJid, statusId }` |

---

## Metrics

Per-session metrics tracked automatically:

```ts
statusEngine.getMetrics(sessionId)
// Returns: StatusMetrics {
//   totalSent, totalFailed, totalRetries,
//   queueLength, avgSendTimeMs,
//   byContentType: { text, image, video, audio, sticker, document, gif },
//   previewsReused, previewsGenerated
// }
```

---

## Configuration

```ts
new StatusEngine(socketManager, bus, mediaEngine, {
  sendDelayMs: 1500,          // delay between queue items
  maxConcurrent: 1,           // always 1 (WhatsApp rate limit)
  defaultMaxRetries: 3,
  retryBackoffMs: 2000,
  maxRetryBackoffMs: 30_000,
  enablePreviewGeneration: true,
});
```

---

## Extension Points

- Add per-group status scheduling via SchedulerService
- Add status analytics dashboard in Web Dashboard
- Add bulk status from file (CSV/JSON list of texts)
- Add status template system (reusable text templates)
- Wire metrics to Web Dashboard `/api/runtime/snapshot`
