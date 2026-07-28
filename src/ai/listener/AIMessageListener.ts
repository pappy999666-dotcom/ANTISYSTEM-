/**
 * PAPPYBOT V2 — AI Message Listener
 *
 * Intercepts 'message:received' events.
 * Activates the AI only when:
 *   1. Sender is SESSION_OWNER or SUDO
 *   2. AI is enabled for the session
 *   3. Message text starts with the configured AI prefix
 *
 * Understands  →  Plans  →  Validates  →  Executes  →  Reports
 */

import { BaseListener } from '../../listeners/BaseListener';
import type { EventPayload } from '../../types/Events';
import type { AIConfigService } from '../services/AIConfigService';
import type { AIMemoryService } from '../services/AIMemoryService';
import type { AIPlannerService } from '../services/AIPlannerService';
import type { AIExecutorService } from '../services/AIExecutorService';
import { container } from '../../core/Container';
import { ROLES } from '../../types/Permissions';
import type { PermissionManager } from '../../permissions/PermissionManager';
import type { AIChatMessage } from '../types/AITypes';
import { logger } from '../../logger/Logger';
import { v4 as uuidv4 } from 'uuid';

const log = logger.child('AIMessageListener');

export class AIMessageListener extends BaseListener {
  readonly name = 'AIMessageListener';
  readonly event = 'message:received' as const;
  readonly priority = 5; // Run after normal command processing

  constructor(
    private readonly configService: AIConfigService,
    private readonly memoryService: AIMemoryService,
    private readonly plannerService: AIPlannerService,
    private readonly executorService: AIExecutorService
  ) {
    super();
  }

  async handle(payload: EventPayload<'message:received'>): Promise<void> {
    const { message } = payload;

    // Only handle text messages
    if (!message.text) return;

    // Skip messages the command engine already handled
    if (message.isCommand) return;

    const sessionId = message.sessionId;

    // Fast path: check if AI is enabled
    const settings = await this.configService.getSettings(sessionId);
    if (!settings.enabled) return;
    if (!settings.apiKey) return;

    // Check prefix match (case-insensitive)
    const text = message.text.trim();
    const prefix = settings.prefix.toLowerCase();
    if (!text.toLowerCase().startsWith(prefix)) return;

    // Extract the query after the prefix
    const query = text.slice(prefix.length).trim();
    if (!query) return;

    // Permission check: SESSION_OWNER or SUDO only
    const permissions = container.tryResolve<PermissionManager>('PermissionManager');
    if (!permissions) return;

    const role = permissions.getRole(message.sender.jid, sessionId);
    const roleHierarchy = [ROLES.USER, ROLES.ADMIN, ROLES.SUDO, ROLES.SESSION_OWNER, ROLES.GLOBAL_OWNER];
    const roleIndex = roleHierarchy.indexOf(role as typeof ROLES[keyof typeof ROLES]);
    const sudoIndex = roleHierarchy.indexOf(ROLES.SUDO);

    if (roleIndex < sudoIndex) {
      // Silently ignore — don't reveal AI is active to unprivileged users
      return;
    }

    log.info('AI request received', { sessionId, sender: message.sender.jid, query: query.slice(0, 100) });

    // Build conversation context
    let history: AIChatMessage[] = [];
    if (settings.memoryEnabled) {
      history = await this.memoryService.getContextMessages(sessionId);
    }

    const requestId = uuidv4();
    const start = Date.now();

    try {
      // 1. Plan
      const plan = await this.plannerService.plan({
        sessionId,
        senderJid: message.sender.jid,
        chatJid: message.chatJid,
        chatType: message.chatType,
        query,
        history,
        quotedText: message.quoted?.text,
        mediaType: message.type !== 'text' ? message.type : undefined,
      });

      log.debug('AI plan generated', {
        requestId,
        intent: plan.intent,
        confidence: plan.confidence,
        steps: plan.steps.length,
      });

      // 2. Execute
      const result = await this.executorService.execute(plan, message);
      const responseText = this.executorService.formatResult(plan, result);

      // 3. Reply — find a reply function from the message context
      const replyFn = payload.context?.reply as ((text: string) => Promise<void>) | undefined;
      if (replyFn) {
        await replyFn(responseText);
      } else {
        log.warn('No reply function in AI message context', { sessionId });
      }

      // 4. Store to memory
      if (settings.memoryEnabled) {
        await this.memoryService.addUserMessage(sessionId, query);
        await this.memoryService.addAssistantMessage(sessionId, responseText);
      }

      log.info('AI request completed', {
        requestId,
        sessionId,
        success: result.success,
        durationMs: Date.now() - start,
      });

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('AI request failed', { requestId, sessionId, error: error.message });

      const replyFn = payload.context?.reply as ((text: string) => Promise<void>) | undefined;
      if (replyFn) {
        await replyFn(`❌ AI error: ${error.message}`).catch(() => void 0);
      }
    }
  }
}
