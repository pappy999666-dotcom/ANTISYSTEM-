/**
 * PAPPYBOT V2 — AI Planner Service
 *
 * Natural Language → Structured Action Plan.
 *
 * Sends the user's query to the AI with a structured JSON schema prompt.
 * The AI returns an AIPlan that the executor then validates and runs.
 */

import { BaseService } from '../../services/BaseService';
import type { AIProviderService } from './AIProviderService';
import type { AIMemoryService } from './AIMemoryService';
import type { AIPlan, AIRequestContext, AIActionType } from '../types/AITypes';
import { parseNaturalTime } from '../utils/TimeParser';
import { logger } from '../../logger/Logger';

const log = logger.child('AIPlannerService');

const PLANNER_SYSTEM = `
You are a WhatsApp bot action planner. The user is the session owner and is speaking naturally.
Your job is to convert their request into a structured JSON action plan.

SUPPORTED ACTION TYPES:
- send_message: Send a text message to a chat
- open_group: Remove group restrictions (allow all to send)
- close_group: Restrict group (only admins can send)
- mute_group: Mute the group
- unmute_group: Unmute the group
- kick_user: Remove a participant from a group
- promote_user: Make a participant an admin
- demote_user: Remove admin from a participant
- warn_user: Issue a warning to a user
- enable_feature: Enable a bot feature (e.g. antilink, welcome, antiflood)
- disable_feature: Disable a bot feature
- get_info: Retrieve group or bot information
- list_members: List group members
- create_poll: Create a group poll
- schedule_task: Create a recurring automation
- cancel_task: Cancel an existing automation by ID
- list_tasks: List active automations
- ai_config: Change AI settings
- reply_text: Reply to the user with information only (no bot action)
- unknown: Cannot determine intent

RESPONSE FORMAT (strict JSON, no markdown):
{
  "intent": "brief description of what the user wants",
  "confidence": 0.0-1.0,
  "steps": [
    {
      "type": "action_type",
      "description": "human-readable step description",
      "params": { "key": "value" },
      "requiresConfirmation": false
    }
  ],
  "scheduledAt": "ISO timestamp or null",
  "cronExpression": "cron string or null",
  "isRecurring": false,
  "rawQuery": "exact user query"
}

DESTRUCTIVE ACTIONS (kick, demote, delete session, leave group, reset settings):
Set "requiresConfirmation": true for these steps.

TIME EXAMPLES:
- "tomorrow at 8 PM" → scheduledAt: <ISO string>
- "every Monday at 9 AM" → cronExpression: "0 9 * * 1"
- "in 2 hours" → scheduledAt: <ISO string>
- "every day at noon" → cronExpression: "0 12 * * *"

FEATURE NAMES for enable_feature/disable_feature:
antilink, antispam, antiflood, antibot, welcome, goodbye, adminprotection

Reply with ONLY the JSON object. No explanation, no markdown.
`;

export class AIPlannerService extends BaseService {
  constructor(
    private readonly providerService: AIProviderService,
    private readonly memoryService: AIMemoryService
  ) {
    super();
  }

  async plan(ctx: AIRequestContext): Promise<AIPlan> {
    const now = Date.now();
    const historyMessages = ctx.history;

    // Build the user prompt with full context
    const userPrompt = this.buildUserPrompt(ctx);

    const messages = [
      ...historyMessages,
      { role: 'user' as const, content: userPrompt },
    ];

    let rawResponse = '';
    try {
      const result = await this.providerService.complete(
        ctx.sessionId,
        messages,
        PLANNER_SYSTEM
      );
      rawResponse = result.text.trim();

      // Strip possible markdown code fences
      const cleaned = rawResponse
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();

      const plan: AIPlan = JSON.parse(cleaned);

      // Resolve natural-language time if cronExpression/scheduledAt are plain strings
      if (plan.scheduledAt && !isIsoDate(plan.scheduledAt)) {
        const resolved = parseNaturalTime(plan.scheduledAt, now);
        plan.scheduledAt = resolved?.isoString;
        plan.cronExpression = resolved?.cron ?? plan.cronExpression;
        plan.isRecurring = resolved?.recurring ?? plan.isRecurring;
      }

      plan.rawQuery = ctx.query;
      return plan;
    } catch (err) {
      log.warn('Failed to parse AI plan', { sessionId: ctx.sessionId, error: String(err), raw: rawResponse.slice(0, 200) });
      return {
        intent: 'unknown',
        confidence: 0,
        steps: [{ type: 'reply_text', description: 'Could not parse intent', params: { text: rawResponse || 'I could not understand that request.' }, requiresConfirmation: false }],
        isRecurring: false,
        rawQuery: ctx.query,
      };
    }
  }

  private buildUserPrompt(ctx: AIRequestContext): string {
    const parts = [`Query: ${ctx.query}`];
    if (ctx.quotedText) parts.push(`Quoted message: "${ctx.quotedText}"`);
    if (ctx.mediaType) parts.push(`Attached media: ${ctx.mediaType}`);
    parts.push(`Chat: ${ctx.chatType} (${ctx.chatJid})`);
    parts.push(`Sender: ${ctx.senderJid}`);
    return parts.join('\n');
  }
}

function isIsoDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(str);
}
