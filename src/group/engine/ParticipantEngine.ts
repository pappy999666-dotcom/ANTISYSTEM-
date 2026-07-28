/**
 * PAPPYBOT V2 — Participant Engine
 *
 * Reusable service methods for all participant management operations.
 * Every command that touches participants calls this engine — never the socket directly.
 *
 * Resolves targets from: mention JID, quoted message sender, or phone number.
 */

import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { ContactCache } from '../../whatsapp/ContactCache';
import type { EventBus } from '../../events/EventBus';
import type { ResolvedTarget } from '../types/Group';
import { normalizeJid, phoneToJid, jidToPhone } from '../../utils/jid';
import { logger } from '../../logger/Logger';

const log = logger.child('ParticipantEngine');

export interface ParticipantActionResult {
  success: boolean;
  jid: string;
  error?: string;
}

export class ParticipantEngine {
  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache,
    private readonly contactCache: ContactCache,
    private readonly bus: EventBus
  ) {}

  // ── Target resolution ────────────────────────────────────────────────────

  /**
   * Resolve a target JID from mention, quoted sender, or raw phone number.
   * Returns undefined if nothing could be resolved.
   */
  resolveTarget(
    mentionedJids: string[],
    quotedSenderJid: string | undefined,
    rawArg: string | undefined
  ): ResolvedTarget | undefined {
    let jid: string | undefined;

    if (mentionedJids.length > 0) {
      jid = normalizeJid(mentionedJids[0]!);
    } else if (quotedSenderJid) {
      jid = normalizeJid(quotedSenderJid);
    } else if (rawArg) {
      const clean = rawArg.replace(/\D/g, '');
      if (clean.length >= 7) jid = phoneToJid(clean);
    }

    if (!jid) return undefined;

    const contact = this.contactCache.get(jid);
    return {
      jid,
      phone: jidToPhone(jid),
      displayName: contact?.displayName ?? contact?.pushName,
    };
  }

  /** Resolve multiple targets from mentions */
  resolveTargets(mentionedJids: string[]): ResolvedTarget[] {
    return mentionedJids.map(j => {
      const jid = normalizeJid(j);
      const contact = this.contactCache.get(jid);
      return { jid, phone: jidToPhone(jid), displayName: contact?.displayName ?? contact?.pushName };
    });
  }

  // ── Validation ───────────────────────────────────────────────────────────

  isInGroup(groupJid: string, jid: string): boolean {
    const meta = this.groupCache.get(groupJid);
    return meta?.participants.some(p => p.jid === jid) ?? false;
  }

  isAdmin(groupJid: string, jid: string): boolean {
    return this.groupCache.isAdmin(groupJid, jid);
  }

  isBotAdmin(sessionId: string, groupJid: string): boolean {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return false;
    const botJid = normalizeJid((sock.user?.id as string) ?? '');
    return this.groupCache.isAdmin(groupJid, botJid);
  }

  getBotJid(sessionId: string): string {
    const sock = this.socketManager.getSocket(sessionId);
    return normalizeJid((sock?.user?.id as string) ?? '');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async kick(sessionId: string, groupJid: string, targetJid: string): Promise<ParticipantActionResult> {
    return this.participantUpdate(sessionId, groupJid, targetJid, 'remove', 'group:participant_removed');
  }

  async promote(sessionId: string, groupJid: string, targetJid: string): Promise<ParticipantActionResult> {
    return this.participantUpdate(sessionId, groupJid, targetJid, 'promote', 'group:participant_promoted');
  }

  async demote(sessionId: string, groupJid: string, targetJid: string): Promise<ParticipantActionResult> {
    return this.participantUpdate(sessionId, groupJid, targetJid, 'demote', 'group:participant_demoted');
  }

  async add(sessionId: string, groupJid: string, targetJid: string): Promise<ParticipantActionResult> {
    return this.participantUpdate(sessionId, groupJid, targetJid, 'add', 'group:participant_added');
  }

  private async participantUpdate(
    sessionId: string,
    groupJid: string,
    targetJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    eventName: string
  ): Promise<ParticipantActionResult> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return { success: false, jid: targetJid, error: 'No active socket' };

    try {
      await sock.groupParticipantsUpdate(groupJid, [targetJid], action);

      // Update cache
      if (action === 'remove') this.groupCache.removeParticipant(groupJid, targetJid);
      else if (action === 'add') this.groupCache.addParticipant(groupJid, { jid: targetJid, isAdmin: false, isSuperAdmin: false });
      else if (action === 'promote') this.groupCache.promoteParticipant(groupJid, targetJid);
      else if (action === 'demote') this.groupCache.demoteParticipant(groupJid, targetJid);

      await this.bus.emit(eventName as never, { sessionId, groupJid, jid: targetJid } as never);
      log.debug('Participant action', { action, groupJid, targetJid });
      return { success: true, jid: targetJid };
    } catch (err) {
      const error = String(err);
      log.warn('Participant action failed', { action, groupJid, targetJid, error });
      return { success: false, jid: targetJid, error };
    }
  }
}
