/**
 * PAPPYBOT V2 — Action Engine
 *
 * Executes reusable actions (delete, warn, kick, etc.) on behalf of
 * every anti feature. No anti module calls the socket directly.
 *
 * Actions:
 *   delete        — delete the offending message
 *   warn          — add a warn via WarnService
 *   kick          — remove participant from group
 *   delete+warn   — delete then warn
 *   delete+kick   — delete then kick
 *   ignore        — no-op (for logging-only rules)
 *   log           — audit log only
 *   mute          — future-ready placeholder
 *   ban           — delegate to BanService
 *   custom        — call ctx.rule.customCallback
 */

import type { ActionType, ActionResult, AntiContext } from '../types/Anti';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { WarnService } from '../services/WarnService';
import type { BanService } from '../services/BanService';
import type { EventBus } from '../../events/EventBus';
import type { TemplateEngine } from './TemplateEngine';
import { logger } from '../../logger/Logger';

const log = logger.child('ActionEngine');

export class ActionEngine {
  constructor(
    private readonly socketManager: SocketManager,
    private readonly warnService: WarnService,
    private readonly banService: BanService,
    private readonly bus: EventBus,
    private readonly templates: TemplateEngine
  ) {}

  async execute(ctx: AntiContext): Promise<ActionResult> {
    const start = Date.now();
    const action = ctx.rule.action;

    try {
      switch (action) {
        case 'delete':      await this.doDelete(ctx); break;
        case 'warn':        await this.doWarn(ctx); break;
        case 'kick':        await this.doKick(ctx); break;
        case 'delete+warn': await this.doDelete(ctx); await this.doWarn(ctx); break;
        case 'delete+kick': await this.doDelete(ctx); await this.doKick(ctx); break;
        case 'ban':         await this.doBan(ctx); break;
        case 'custom':      await ctx.rule.customCallback?.(ctx); break;
        case 'ignore':
        case 'log':
        case 'mute':        break; // no-op / future
      }

      await this.bus.emit('anti:triggered', {
        sessionId: ctx.sessionId,
        groupJid: ctx.groupJid,
        senderJid: ctx.senderJid,
        detectorId: ctx.detectionResult.detectorId,
        action,
        reason: ctx.detectionResult.reason ?? action,
      });

      return { action, success: true, executionMs: Date.now() - start };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error('Action failed', { action, sessionId: ctx.sessionId, error });
      return { action, success: false, error, executionMs: Date.now() - start };
    }
  }

  // ── Private actions ──────────────────────────────────────────────────────

  private async doDelete(ctx: AntiContext): Promise<void> {
    const sock = this.socketManager.getSocket(ctx.sessionId);
    if (!sock) return;
    try {
      await sock.sendMessage(ctx.groupJid, { delete: ctx.messageKey });
      await this.bus.emit('anti:message_deleted', {
        sessionId: ctx.sessionId,
        groupJid: ctx.groupJid,
        messageId: ctx.messageId,
        reason: ctx.detectionResult.reason ?? ctx.detectionResult.detectorId,
      });
    } catch (err) {
      log.warn('Delete failed', { sessionId: ctx.sessionId, messageId: ctx.messageId, error: String(err) });
    }
  }

  private async doWarn(ctx: AntiContext): Promise<void> {
    const { count, limit } = await this.warnService.addWarn({
      sessionId: ctx.sessionId,
      groupJid: ctx.groupJid,
      userJid: ctx.senderJid,
      reason: ctx.detectionResult.reason ?? ctx.detectionResult.detectorId,
      moderatorJid: ctx.sessionId,
    });

    const templateKey = ctx.rule.templateKey ?? ctx.detectionResult.detectorId;
    const warnMsg = this.templates.resolve('warn', {
      ...ctx.templateVars,
      count: String(count),
      limit: String(limit),
    });

    if (warnMsg) {
      const sock = this.socketManager.getSocket(ctx.sessionId);
      if (sock) {
        await sock.sendMessage(ctx.groupJid, {
          text: warnMsg,
          mentions: [ctx.senderJid],
        }).catch(() => undefined);
      }
    }

    // Auto-kick on limit
    if (count >= limit) {
      await this.doKick(ctx);
    }

    void templateKey; // used above
  }

  private async doKick(ctx: AntiContext): Promise<void> {
    const sock = this.socketManager.getSocket(ctx.sessionId);
    if (!sock) return;
    try {
      await sock.groupParticipantsUpdate(ctx.groupJid, [ctx.senderJid], 'remove');
      await this.bus.emit('anti:user_kicked', {
        sessionId: ctx.sessionId,
        groupJid: ctx.groupJid,
        userJid: ctx.senderJid,
        reason: ctx.detectionResult.reason ?? ctx.detectionResult.detectorId,
      });
    } catch (err) {
      log.warn('Kick failed', { sessionId: ctx.sessionId, senderJid: ctx.senderJid, error: String(err) });
    }
  }

  private async doBan(ctx: AntiContext): Promise<void> {
    await this.banService.ban({
      sessionId: ctx.sessionId,
      groupJid: ctx.groupJid,
      userJid: ctx.senderJid,
      reason: ctx.detectionResult.reason ?? ctx.detectionResult.detectorId,
      moderatorJid: ctx.sessionId,
      permanent: true,
    });
    await this.doKick(ctx);
  }
}
