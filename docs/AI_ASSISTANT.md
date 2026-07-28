# PAPPYBOT V2 — AI Assistant & Automation Engine

## Overview

The AI Assistant is a session-level intelligent agent that understands natural language, translates requests into bot actions, schedules tasks, and automates repetitive work.

It sits above the existing command system and reuses every existing service — it never reimplements bot logic.

```
User speaks naturally
      ↓
AIMessageListener detects prefix
      ↓
Permission check (SESSION_OWNER or SUDO only)
      ↓
AIPlannerService → structured AIPlan (via AI provider)
      ↓
AIExecutorService → calls existing services
      ↓
Reply + store to AIMemoryService
```

---

## Provider Interface

Every AI provider implements `AIProvider`:

```typescript
interface AIProvider {
  readonly name: string;
  complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult>;
  supportsVision(): boolean;
}
```

### Supported Providers

| ID | Service | Vision |
|---|---|---|
| `openai` | OpenAI Chat Completions | ✅ |
| `groq` | Groq (ultra-fast) | ❌ |
| `gemini` | Google Gemini | ✅ |
| `anthropic` | Anthropic Claude | ✅ |
| `openrouter` | OpenRouter (300+ models) | ✅ |

### Adding a New Provider

1. Create `src/ai/providers/MyProvider.ts` implementing `AIProvider`
2. Register it in `src/ai/providers/ProviderFactory.ts`
3. No other code changes needed

---

## Session AI Settings

Each WhatsApp session has independent AI configuration stored in `ai_settings` DB table:

| Field | Default | Description |
|---|---|---|
| `enabled` | `false` | Master on/off switch |
| `provider` | `openai` | AI provider name |
| `apiKey` | `''` | Provider API key |
| `model` | `gpt-4o-mini` | Model name |
| `temperature` | `0.7` | Sampling temperature |
| `maxTokens` | `1024` | Max output tokens |
| `memoryEnabled` | `true` | Conversation memory |
| `automationEnabled` | `true` | Scheduled tasks |
| `responseStyle` | `friendly` | Response tone |
| `language` | `en` | Response language |
| `prefix` | `pappy` | Activation keyword |

Sessions are fully isolated — one session cannot read another's settings or memory.

---

## Commands

| Command | Description | Permission |
|---|---|---|
| `.ai on` | Enable AI assistant | SESSION_OWNER |
| `.ai off` | Disable AI assistant | SESSION_OWNER |
| `.setaiprefix <word>` | Change activation prefix | SESSION_OWNER |
| `.setaiprovider <name>` | Switch AI provider | SESSION_OWNER |
| `.setaimodel <model>` | Change AI model | SESSION_OWNER |
| `.setaitoken <key>` | Set API key (private chat only) | SESSION_OWNER |
| `.aiinfo` | Show status dashboard | SESSION_OWNER |
| `.aimemory on\|off` | Toggle conversation memory | SESSION_OWNER |
| `.aiclear` | Wipe all memory entries | SESSION_OWNER |

---

## Activation

The AI responds only when ALL conditions are met:

1. Message text starts with the configured prefix (e.g. `pappy`)
2. Sender has `SESSION_OWNER` or `SUDO` role
3. AI is `enabled` for the session
4. API key is configured

**Examples:**
```
pappy mute this group tomorrow at 2 PM
pappy send a weekly reminder every Monday at 9 AM
pappy open the group in one hour
pappy warn @user for spamming
pappy enable antilink
pappy show active tasks
```

---

## Natural Language Engine

The `AIPlannerService` sends the user's query to the configured AI provider with a structured system prompt that instructs the AI to return a JSON action plan.

### Plan Schema

```typescript
interface AIPlan {
  intent: string;         // e.g. "close group at 10 PM"
  confidence: number;     // 0.0 – 1.0
  steps: AIActionStep[];
  scheduledAt?: string;   // ISO timestamp for one-time
  cronExpression?: string; // for recurring
  isRecurring: boolean;
  rawQuery: string;
}

interface AIActionStep {
  type: AIActionType;
  description: string;
  params: Record<string, unknown>;
  requiresConfirmation?: boolean;  // true for destructive actions
}
```

### Supported Action Types

| Type | Description |
|---|---|
| `send_message` | Send text to a chat |
| `open_group` | Remove restrictions |
| `close_group` | Admin-only mode |
| `mute_group` / `unmute_group` | Mute control |
| `kick_user` | Remove participant |
| `promote_user` / `demote_user` | Admin role changes |
| `warn_user` | Issue warning via Anti Engine |
| `enable_feature` / `disable_feature` | Toggle bot features |
| `get_info` | Fetch group metadata |
| `list_members` | List participants |
| `list_tasks` | Show automations |
| `schedule_task` | Create recurring automation |
| `cancel_task` | Cancel by ID |
| `reply_text` | Information-only reply |

---

## Memory System

The `AIMemoryService` maintains per-session conversation history in the `ai_memory` DB table.

- **Stored**: up to 200 entries per session
- **Sent to AI**: last 20 entries per request (configurable)
- **Pruning**: automatic when limit exceeded
- **Isolation**: strict session boundaries — one session cannot access another's memory

### Memory Operations

```typescript
memoryService.addUserMessage(sessionId, content)
memoryService.addAssistantMessage(sessionId, content)
memoryService.getContextMessages(sessionId)   // returns AIChatMessage[]
memoryService.clearSession(sessionId)
memoryService.getSummary(sessionId)
```

---

## Automation Engine

The `AIAutomationService` persists recurring tasks in `ai_automations` and re-schedules them on startup via `SchedulerService`.

### Creating an Automation

```typescript
automationService.create(
  sessionId,
  'Daily greeting',           // name
  '0 9 * * *',               // cron
  'send_message',             // action type
  { chatJid: '...', text: 'Good morning! 🌅' },
  undefined,
  'Send morning message'
)
```

### Natural Language Scheduling

```typescript
automationService.createFromNaturalLanguage(
  sessionId,
  'Weekly report',
  'every Monday at 9 AM',
  'send_message',
  { text: 'Weekly status update...' }
)
```

### Time Expressions (built-in parser, no dependencies)

| Expression | Result |
|---|---|
| `every day at 9 AM` | `0 9 * * *` |
| `every Monday at 6 PM` | `0 18 * * 1` |
| `every hour` | `0 * * * *` |
| `daily at noon` | `0 12 * * *` |
| `in 2 hours` | ISO timestamp |
| `tomorrow at 8 PM` | ISO timestamp |
| `next Friday` | ISO timestamp |

---

## Permission Model

The AI strictly respects the existing RBAC system:

| Role | AI Access |
|---|---|
| `USER` | ❌ AI ignores messages |
| `ADMIN` | ❌ AI ignores messages |
| `SUDO` | ✅ Can activate AI |
| `SESSION_OWNER` | ✅ Full AI + config access |
| `GLOBAL_OWNER` | ✅ Full AI + config access |

Destructive actions (kick, demote, delete session) always set `requiresConfirmation: true` in the plan, requiring an additional confirmation step.

---

## Safety

Before executing destructive steps:

1. The planner marks them with `requiresConfirmation: true`
2. The executor skips those steps and returns a confirmation prompt
3. The user must explicitly confirm (re-send the command with "yes")

Destructive actions:
- `kick_user`
- `demote_user`
- `cancel_task` (with data loss)

---

## Logging

All AI requests are logged with:

```
{ sessionId, provider, model, intent, confidence, steps, durationMs, tokensUsed }
```

**Never logged:** API keys, raw credentials, personal message content beyond intent.

---

## Scheduler Integration

Automations use the existing `SchedulerService` directly:

```
AIAutomationService.create()
  → SchedulerService.schedule({ id: `ai_auto_${task.id}`, cronExpression, fn })
```

Job IDs follow the pattern `ai_auto_<uuid>` to avoid collisions with other scheduled jobs.

---

## Dashboard Integration

AI status is accessible via the DI container from both Telegram and Web dashboards:

```typescript
const configService = container.resolve<AIConfigService>('AIConfigService');
const automationService = container.resolve<AIAutomationService>('AIAutomationService');

const settings = await configService.getSettings(sessionId);
const dashboard = await automationService.getDashboardInfo(sessionId);
```

---

## Extension Points

| Extension | Where |
|---|---|
| New AI provider | `src/ai/providers/` + `ProviderFactory.ts` |
| New action type | `AIExecutorService.dispatch()` + `AITypes.ts` |
| New command | `src/ai/commands/` + `AIPlugin.ts` |
| Custom memory backend | Implement `AIMemoryRepository` interface |
| Custom planner prompt | `AIPlannerService.PLANNER_SYSTEM` |
