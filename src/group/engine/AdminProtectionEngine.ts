/**
 * PAPPYBOT V2 — Admin Protection Engine
 *
 * Protects group admins from unauthorized demotion/promotion.
 * Triggered by group-participants.update events via AdminProtectionListener.
 *
 * Modes:
 *   dwp  — demote offender + warn + restore previous admin
 *   dnp  — demote offender + no restore
 *   kwp  — kick offender + warn + restore previous admin
 *   knp  — kick offender + no restore
 *
 * Requires the bot to be a group admin to take action.
 */

import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { EventBus } from '../../events/EventBus';
import type { AdminProtectionConfig, AdminProtectionMode } from '../types/Group';
import { normalizeJid } from '../../utils/jid';
import { logger } from '../../logger/Logger';

const log = logger.child('AdminProtectionEngine');

export class AdminProtectionEngine {
  private readonly configs = new Map<string, AdminProtectionConfig>();

  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache,
    private readonly bus: EventBus
  ) {}

  setConfig(sessionId: string, groupJid: string, config: Partial<AdminProtectionConfig>): void {
    const k = `${sessionId}:${groupJid}`;
    const existing = this.configs.get(k) ?? { antiDemote: false, antiPromote: false, demoteMode: 'dwp', promoteMode: 'dwp' };
    this.configs.set(k, { ...existing, ...config });
  }

  getConfig(sessionId: string, groupJid: string): AdminProtectionConfig {
    return this.configs.get(`${sessionId}:${groupJid}`) ?? { antiDemote: false, antiPromote: false, demoteMode: 'dwp', promoteMode: 'dwp' };
  }

  async handleDemote(sessionId: string, groupJid: string, offenderJid: string, victimJid: string): Promise<void> {
    const cfg = this.getConfig(sessionId, groupJid);
    if (!cfg.antiDemote || !this.isBotAdmin(sessionId, groupJid)) return;
    log.info('AntiDemote triggered', { groupJid, offenderJid, victimJid });
    await this.applyProtection(sessionId, groupJid, offenderJid, victimJid, cfg.demoteMode, 'demote');
  }

  async handlePromote(sessionId: string, groupJid: string, offenderJid: string, victimJid: string): Promise<void> {
    const cfg = this.getConfig(sessionId, groupJid);
    if (!cfg.antiPromote || !this.isBotAdmin(sessionId, groupJid)) return;
    log.info('AntiPromote triggered', { groupJid, offenderJid, victimJid });
    await this.applyProtection(sessionId, groupJid, offenderJid, victimJid, cfg.promoteMode, 'promote');
  }

  private async applyProtection(
    sessionId: string, groupJid: string,
    offenderJid: string, victimJid: string,
    mode: AdminProtectionMode, triggerType: 'demote' | 'promote'
  ): Promise<void> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return;
    const shouldKick = mode === 'kwp' || mode === 'knp';
    const shouldRestore = mode === 'dwp' || mode === 'kwp';
    try {
      if (shouldKick) {
        await sock.groupParticipantsUpdate(groupJid, [offenderJid], 'remove');
        this.groupCache.removeParticipant(groupJid, offenderJid);
      } else {
        await sock.groupParticipantsUpdate(groupJid, [offenderJid], 'demote');
        this.groupCache.demoteParticipant(groupJid, offenderJid);
      }
      if (shouldRestore && triggerType === 'demote') {
        await sock.groupParticipantsUpdate(groupJid, [victimJid], 'promote');
        this.groupCache.promoteParticipant(groupJid, victimJid);
      }
      await this.bus.emit('group:admin_protection_triggered', { sessionId, groupJid, offenderJid, victimJid, mode, triggerType } as never);
    } catch (err) {
      log.warn('Admin protection action failed', { groupJid, error: String(err) });
    }
  }

  private isBotAdmin(sessionId: string, groupJid: string): boolean {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return false;
    return this.groupCache.isAdmin(groupJid, normalizeJid((sock.user?.id as string) ?? ''));
  }
}
