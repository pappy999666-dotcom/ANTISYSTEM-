/**
 * PAPPYBOT V2 — Ban Service
 *
 * Manages permanent and temporary bans per group.
 * Banned users have future messages deleted while the ban is active.
 * Future prompt: persist to DatabaseManager.
 */

import type { BanRecord } from '../types/Anti';
import type { EventBus } from '../../events/EventBus';
import { logger } from '../../logger/Logger';

const log = logger.child('BanService');

export class BanService {
  /** key: `${sessionId}:${groupJid}:${userJid}` */
  private readonly bans = new Map<string, BanRecord>();

  constructor(private readonly bus: EventBus) {}

  private key(sessionId: string, groupJid: string, userJid: string): string {
    return `${sessionId}:${groupJid}:${userJid}`;
  }

  async ban(opts: {
    sessionId: string;
    groupJid: string;
    userJid: string;
    reason: string;
    moderatorJid: string;
    permanent?: boolean;
    expiresAt?: number;
  }): Promise<BanRecord> {
    const record: BanRecord = {
      sessionId: opts.sessionId,
      groupJid: opts.groupJid,
      userJid: opts.userJid,
      reason: opts.reason,
      moderatorJid: opts.moderatorJid,
      bannedAt: Date.now(),
      permanent: opts.permanent ?? true,
      expiresAt: opts.expiresAt,
    };
    this.bans.set(this.key(opts.sessionId, opts.groupJid, opts.userJid), record);
    log.info('User banned', { userJid: opts.userJid, groupJid: opts.groupJid });
    await this.bus.emit('anti:user_banned', {
      sessionId: record.sessionId,
      groupJid: record.groupJid,
      userJid: record.userJid,
      reason: record.reason,
      bannedAt: record.bannedAt,
      permanent: record.permanent,
    });
    return record;
  }

  async unban(sessionId: string, groupJid: string, userJid: string): Promise<boolean> {
    const deleted = this.bans.delete(this.key(sessionId, groupJid, userJid));
    if (deleted) await this.bus.emit('anti:user_unbanned', { sessionId, groupJid, userJid });
    return deleted;
  }

  isBanned(sessionId: string, groupJid: string, userJid: string): boolean {
    const record = this.bans.get(this.key(sessionId, groupJid, userJid));
    if (!record) return false;
    if (!record.permanent && record.expiresAt && Date.now() > record.expiresAt) {
      this.bans.delete(this.key(sessionId, groupJid, userJid));
      return false;
    }
    return true;
  }

  getBan(sessionId: string, groupJid: string, userJid: string): BanRecord | undefined {
    return this.bans.get(this.key(sessionId, groupJid, userJid));
  }

  getBannedInGroup(sessionId: string, groupJid: string): BanRecord[] {
    return [...this.bans.values()].filter(
      b => b.sessionId === sessionId && b.groupJid === groupJid
    );
  }
}
