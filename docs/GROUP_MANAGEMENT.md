# Group Management Engine

Full group management system for PAPPYBOT V2. Loaded as a plugin — zero changes to core required.

---

## Architecture

```
GroupManagementPlugin
  └── GroupEngine (orchestrator)
        ├── ParticipantEngine   — kick / promote / demote / add + target resolution
        ├── TagEngine           — tag all members with any media type
        ├── WelcomeEngine       — welcome / goodbye with templates + media
        ├── AdminProtectionEngine — antiDemote / antiPromote with 4 modes
        ├── GroupTemplateEngine — per-group template store
        ├── GroupHistoryService — group creation records
        └── IntroCardService    — placeholder for future intro URL buttons
```

---

## Commands

| Command | Aliases | Role | Description |
|---|---|---|---|
| `kick` | `remove` | ADMIN | Kick a participant |
| `promote` | — | ADMIN | Promote to admin |
| `demote` | — | ADMIN | Demote from admin |
| `tag` | `tagall`, `everyone` | ADMIN | Tag all members |
| `groupinfo` | `ginfo`, `gcinfo` | USER | Show group info |
| `info` | — | USER | Show user profile info |
| `setname` | `groupname`, `gcname` | ADMIN | Change group name |
| `setdesc` | `desc`, `setdescription` | ADMIN | Change group description |
| `link` | `invite`, `invitelink` | ADMIN | Get or revoke invite link |
| `leave` | `leavegroup` | SESSION_OWNER | Bot leaves the group |
| `setgpic` | `setgrouppic`, `grouppic` | ADMIN | Set group picture (reply to image) |
| `setpic` | `setprofilepic`, `botpic` | SESSION_OWNER | Set bot profile picture |
| `creategroup` | `newgroup`, `mkgroup` | SESSION_OWNER | Create a new group |

---

## Target Resolution

Participant commands (`kick`, `promote`, `demote`) resolve targets in priority order:

1. `@mention` in the message
2. Quoted message sender
3. Raw phone number argument

---

## Tag Engine

`tag [message]` — mentions every participant in the group.

- Reply to media (image/video/audio/voice/sticker/document) to forward it with all mentions
- Plain text if no media or message provided
- Existing link preview metadata is reused as-is

---

## Welcome / Goodbye

Configured per-group via `WelcomeEngine`. Templates support variables:

| Variable | Value |
|---|---|
| `&mention` | `@phone` of the joining/leaving user |
| `&gcname` | Group name |
| `&count` | Current member count |
| `&date` | Current date |
| `&time` | Current time |

Default templates are set automatically. Override per-group:

```ts
groupEngine.welcome.setWelcomeConfig(groupJid, {
  enabled: true,
  template: 'Welcome &mention to &gcname! 🎉',
  mediaUrl: 'https://example.com/banner.jpg',
  mediaType: 'image',
});
```

---

## Admin Protection

Protects admins from unauthorized demotion or promotion.

### Modes

| Mode | Behavior |
|---|---|
| `dwp` | Demote offender + warn + re-promote victim |
| `dnp` | Demote offender + no re-promote |
| `kwp` | Kick offender + warn + re-promote victim |
| `knp` | Kick offender + no re-promote |

Configure per-group:

```ts
groupEngine.adminProtection.setConfig(groupJid, {
  antiDemote: true,
  antiPromote: false,
  demoteMode: 'kwp',
  promoteMode: 'dwp',
});
```

---

## Group Creation Wizard

`creategroup <name> @mentions...`

1. Creates the group with all mentioned participants
2. Optionally sets description and picture
3. Optionally promotes a target to admin
4. Returns the invite link
5. Records the creation in `GroupHistoryService` for audit/revert

---

## Events Emitted

| Event | Payload |
|---|---|
| `group:created` | `{ sessionId, groupJid, subject }` |
| `group:picture_changed` | `{ sessionId, groupJid }` |
| `group:subject_changed` | `{ sessionId, groupJid, subject }` |
| `group:description_changed` | `{ sessionId, groupJid }` |
| `group:welcome_sent` | `{ sessionId, groupJid, jid }` |
| `group:goodbye_sent` | `{ sessionId, groupJid, jid }` |
| `group:admin_protection_triggered` | `{ sessionId, groupJid, jid, type, mode }` |

---

## Adding to App

The plugin is auto-loaded in `App.initialize()` at step 16. No manual wiring needed.

To load it manually in a custom setup:

```ts
const groupPlugin = new GroupManagementPlugin();
await pluginManager.load(groupPlugin);
```
