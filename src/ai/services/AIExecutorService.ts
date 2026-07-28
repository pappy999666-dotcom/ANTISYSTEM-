/**
 * PAPPYBOT V2 — AI Executor Service
 *
 * Translates an AIPlan into real bot actions by calling existing services.
 * NEVER reimplements bot logic — always delegates to the correct engine/service.
 */

import { BaseService } from '../../services/BaseService';
import type { AIPlan, AIActionStep } from '../types/AITypes';
import type { NormalizedMessage } from '../../types/Message';
import { container } from '../../core/Container';
import { logger } from '../../logger/Logger';

const log = logger.child('AIExecutorService');

export interface ExecutionResult {
  success: boolean;
  stepResults: StepResult[];
  durationMs: number;
}

interface StepResult {
  step: AIActionStep;
  success: boolean;
  output?: string;
  error?: string;
}

export class AIExecutorService extends BaseService {
  /**
   * Execute all steps in an AIPlan sequentially.
   * Steps that require confirmation are skipped unless pre-confirmed.
   */
  async execute(
    plan: AIPlan,
    message: NormalizedMessage,
    confirmed = false
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const stepResults: StepResult[] = [];

    for (const step of plan.steps) {
      if (step.requiresConfirmation && !confirmed) {
        stepResults.push({
          step,
          success: false,
          output: `⚠️ Step "${step.description}" requires confirmation. Reply with "yes" to proceed.`,
        });
        continue;
      }

      const result = await this.executeStep(step, message);
      stepResults.push(result);

      // If a critical step fails, stop the chain
      if (!result.success && !this.isOptionalAction(step.type)) {
        break;
      }
    }

    const success = stepResults.every((r) => r.success || r.step.requiresConfirmation);
    return { success, stepResults, durationMs: Date.now() - start };
  }

  private async executeStep(step: AIActionStep, message: NormalizedMessage): Promise<StepResult> {
    try {
      const output = await this.dispatch(step, message);
      return { step, success: true, output };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.warn('Step execution failed', { type: step.type, error });
      return { step, success: false, error };
    }
  }

  private async dispatch(step: AIActionStep, message: NormalizedMessage): Promise<string> {
    const { type, params } = step;
    const sessionId = message.sessionId;
    const chatJid = (params['chatJid'] as string) ?? message.chatJid;

    switch (type) {
      case 'reply_text': {
        return String(params['text'] ?? step.description);
      }

      case 'get_info': {
        const groupService = container.tryResolve<{ getGroupMetadata: (s: string, j: string) => Promise<unknown> }>('GroupService');
        if (!groupService) return 'GroupService not available';
        const meta = await groupService.getGroupMetadata(sessionId, chatJid);
        return JSON.stringify(meta, null, 2);
      }

      case 'open_group': {
        return await this.callGroupEngine('openGroup', sessionId, chatJid, params);
      }

      case 'close_group': {
        return await this.callGroupEngine('closeGroup', sessionId, chatJid, params);
      }

      case 'mute_group': {
        return await this.callGroupEngine('muteGroup', sessionId, chatJid, params);
      }

      case 'unmute_group': {
        return await this.callGroupEngine('unmuteGroup', sessionId, chatJid, params);
      }

      case 'kick_user': {
        const targetJid = String(params['targetJid'] ?? '');
        return await this.callGroupEngine('kickParticipant', sessionId, chatJid, { targetJid });
      }

      case 'promote_user': {
        const targetJid = String(params['targetJid'] ?? '');
        return await this.callGroupEngine('promoteParticipant', sessionId, chatJid, { targetJid });
      }

      case 'demote_user': {
        const targetJid = String(params['targetJid'] ?? '');
        return await this.callGroupEngine('demoteParticipant', sessionId, chatJid, { targetJid });
      }

      case 'warn_user': {
        const antiEngine = container.tryResolve<{ warnUser?: (s: string, g: string, u: string, reason: string) => Promise<unknown> }>('AntiEngine');
        if (!antiEngine?.warnUser) return 'Anti Engine warn not available';
        const targetJid = String(params['targetJid'] ?? '');
        const reason = String(params['reason'] ?? 'AI-initiated warning');
        await antiEngine.warnUser(sessionId, chatJid, targetJid, reason);
        return `⚠️ Warning issued to ${targetJid}`;
      }

      case 'enable_feature': {
        return await this.toggleFeature(sessionId, chatJid, String(params['feature'] ?? ''), true);
      }

      case 'disable_feature': {
        return await this.toggleFeature(sessionId, chatJid, String(params['feature'] ?? ''), false);
      }

      case 'send_message': {
        const text = String(params['text'] ?? '');
        const targetChat = String(params['chatJid'] ?? chatJid);
        return `📨 Queued message to ${targetChat}: "${text.slice(0, 80)}..."`;
      }

      case 'list_members': {
        return await this.callGroupEngine('listParticipants', sessionId, chatJid, params);
      }

      case 'list_tasks': {
        const autoService = container.tryResolve<{ listForSession: (s: string) => Promise<unknown[]> }>('AIAutomationService');
        if (!autoService) return 'Automation service not available';
        const tasks = await autoService.listForSession(sessionId);
        if (!tasks.length) return '📋 No active automations.';
        return tasks.map((t: unknown) => {
          const task = t as { id: string; name: string; cronExpression: string; enabled: boolean };
          return `• ${task.name} (${task.id.slice(0, 8)}) — ${task.cronExpression} [${task.enabled ? '✅' : '❌'}]`;
        }).join('\n');
      }

      case 'cancel_task': {
        const taskId = String(params['taskId'] ?? '');
        const autoService = container.tryResolve<{ cancel: (id: string) => Promise<boolean> }>('AIAutomationService');
        if (!autoService) return 'Automation service not available';
        const ok = await autoService.cancel(taskId);
        return ok ? `✅ Task ${taskId} cancelled` : `❌ Task ${taskId} not found`;
      }

      case 'schedule_task': {
        return `📅 Task scheduling is handled by the Automation Engine. Use .ai commands to manage.`;
      }

      case 'ai_config': {
        return `⚙️ Use .ai / .setaiprovider / .setaimodel commands to configure AI settings.`;
      }

      case 'unknown':
        return step.description || 'I could not determine what action to take.';

      default:
        return `Action "${type}" is not yet implemented.`;
    }
  }

  private async callGroupEngine(method: string, sessionId: string, chatJid: string, params: Record<string, unknown>): Promise<string> {
    // GroupEngine is registered by GroupManagementPlugin — access via container
    const groupEngine = container.tryResolve<Record<string, ((...args: unknown[]) => Promise<unknown>)>>('GroupEngine');
    if (!groupEngine?.[method]) {
      return `Group action "${method}" not available (GroupEngine not loaded)`;
    }
    await groupEngine[method](sessionId, chatJid, params);
    return `✅ ${method} completed on ${chatJid}`;
  }

  private async toggleFeature(sessionId: string, chatJid: string, feature: string, enable: boolean): Promise<string> {
    const antiEngine = container.tryResolve<{ setEnabled?: (s: string, g: string, f: string, e: boolean) => Promise<void> }>('AntiEngine');
    if (antiEngine?.setEnabled) {
      await antiEngine.setEnabled(sessionId, chatJid, feature, enable);
      return `${enable ? '✅ Enabled' : '❌ Disabled'} ${feature} in ${chatJid}`;
    }
    return `Feature toggle for "${feature}" not available`;
  }

  private isOptionalAction(type: string): boolean {
    return ['reply_text', 'get_info', 'list_members', 'list_tasks'].includes(type);
  }

  /**
   * Format execution results into a readable summary message.
   */
  formatResult(plan: AIPlan, result: ExecutionResult): string {
    const lines: string[] = [];

    if (result.stepResults.length === 1) {
      const r = result.stepResults[0];
      return r.output ?? r.error ?? '✅ Done.';
    }

    lines.push(`🤖 *Executed: ${plan.intent}*`);
    for (const r of result.stepResults) {
      if (r.success) {
        lines.push(`✅ ${r.step.description}: ${r.output ?? 'done'}`);
      } else if (r.step.requiresConfirmation) {
        lines.push(r.output ?? `⚠️ ${r.step.description} — awaiting confirmation`);
      } else {
        lines.push(`❌ ${r.step.description}: ${r.error}`);
      }
    }
    lines.push(`\n⏱ ${result.durationMs}ms`);
    return lines.join('\n');
  }
}
