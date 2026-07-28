# PAPPYBOT V2 — Command Reference

Default prefix: `!` (configurable via `CMD_PREFIX` env var)

---

## Built-in Commands

### !ping

Show live bot metrics.

```
!ping
```

Reports: API round-trip latency, Baileys presence latency, heap memory, CPU load, uptime, connected sessions.

---

### !setsudo @user

Grant SUDO role to a user. Owner only.

```
!setsudo @user
!setsudo 628123456789
```

---

### !delsudo @user

Revoke SUDO role from a user. Owner only.

```
!delsudo @user
```

---

## Group Management Commands

### !kick @user

Remove a participant from the group. Admin only.

```
!kick @user
```

---

### !promote @user

Promote a participant to group admin. Admin only.

```
!promote @user
```

---

### !demote @user

Demote a group admin to participant. Admin only.

```
!demote @user
```

---

### !tag [message]

Mention all group members.

```
!tag Good morning everyone!
```

---

### !open

Set group to open (anyone can send messages).

```
!open
```

---

### !close

Set group to announcement mode (only admins can send).

```
!close
```

---

### !setname <name>

Rename the group. Admin only.

```
!setname My Awesome Group
```

---

### !setdesc <description>

Set the group description. Admin only.

```
!setdesc Welcome to our group!
```

---

### !creategroup <name>

Create a new WhatsApp group. Owner/Sudo only.

```
!creategroup My New Group
```

---

### !groupinfo

Show current group metadata.

```
!groupinfo
```

---

### !userinfo [@user]

Show info about a user (or yourself if no target).

```
!userinfo
!userinfo @user
```

---

## AI Assistant Commands

### .ai on / .ai off

Enable or disable the AI assistant for this session.

```
.ai on
.ai off
```

---

### .setaiprovider <provider>

Set the AI provider. Options: `openai`, `groq`, `gemini`, `anthropic`, `openrouter`.

```
.setaiprovider openai
```

---

### .setaimodel <model>

Set the AI model.

```
.setaimodel gpt-4o-mini
.setaimodel llama-3.3-70b-versatile
```

---

### .setaitoken <token>

Set the API key for the current provider. Sudo only.

```
.setaitoken sk-...
```

---

### .setaiprefix <prefix>

Set the natural language trigger prefix (default: `pappy`).

```
.setaiprefix bot
```

---

### .aiinfo

Show current AI configuration.

```
.aiinfo
```

---

### .aimemory clear

Clear the AI conversation memory for the current chat.

```
.aimemory clear
```

---

## Natural Language (AI)

When AI is enabled, speak naturally after the prefix:

```
pappy close the group at 10 PM
pappy mute everyone for 2 hours
pappy send a good morning message every day at 8 AM
pappy warn @user for spamming
pappy enable antilink
pappy kick anyone who sends links
```

---

## Group Status Commands

### !gstatus on / !gstatus off

Enable or disable group status automation.

---

## Permission Levels

| Level | Role | Who |
|---|---|---|
| 5 | `GLOBAL_OWNER` | Set via `GLOBAL_OWNER_NUMBER` env |
| 4 | `SESSION_OWNER` | Owner of a specific session |
| 3 | `SUDO` | Assigned via `!setsudo` |
| 2 | `ADMIN` | WhatsApp group admin |
| 1 | `USER` | Everyone else |
