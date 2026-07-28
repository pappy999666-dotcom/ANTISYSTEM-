/**
 * PAPPYBOT V2 — Warn Service
 *
 * Single shared warning service used by every anti feature and command.
 * No anti module duplicates warn logic.
 *
 * Warn records are stored in memory (Map).
 * Future prompt: persist to DatabaseManager.
 */

import type { WarnRecord } from '../types/Anti';
import type { AntiConfigManager } from '../core/ConfigManager';
import type { EventBus } from '../../events/EventBus';
import { logger } from '../../logger/Logger';
import { v4 as uuidv4 } from 'uuid';

const log = logger.child('WarnService');

export class WarnService {
  /** key: `${sessionId}:${groupJid}:${userJid}` → warn records */
  private readonly warns = new Map<string, WarnRecord[]>();

  constructor(
    private readonly configManager: AntiConfigManager,
    private readonly bus: EventBus
  ) {}

  private key(sessionId: string, groupJid: string, userJid: string): string {
    return `${sessionId}:${groupJid}:${userJid}`;
  }

  // ── Add ──────────────────────────────────────────────────────────────────

  async addWarn(opts: {
    sessionId: string;
    groupJid: string;
    userJid: string;
    reason: string;
    moderatorJid: string;
  }): Promise<{ count: number; limit: number; record: WarnRecord }> {
    const { sessionId, groupJid, userJid, reason, moderatorJid } = opts;
    const k = this.key(sessionId, groupJid, userJid);
    let records = this.warns.get(k);
    if (!records) { records = []; this.warns.set(k, records); }

    const count = records.length + 1;
    const limit = this.configManager.getWarnLimit(sessionId, groupJid);

    const record: WarnRecord = {
      id: uuidv4(),
      sessionId, groupJid, userJid, reason, moderatorJid,
      timestamp: Date.now(),
      count,
    };
    records.push(record);

    log.debug('Warn added', { userJid, groupJid, count, limit });

    await this.bus.emit('anti:warn_added', { sessionId, groupJid, userJid, count, limit, reason });

    return { count, limit, record };
  }

  // ── Remove ───────────────────────────────────────────────────────────────

  async removeWarn(sessionId: string, groupJid: string, userJid: string): Promise<boolean> {
    const k = this.key(sessionId, groupJid, userJid);
    const records = this.warns.get(k);
    if (!records?.length) return false;
    records.pop();
    const count = records.length;
    await this.bus.emit('anti:warn_removed', { sessionId, groupJid, userJid, count });
    return true;
  }

  async resetWarns(sessionId: string, groupJid: string, userJid: string): Promise<void> {
    this.warns.delete(this.key(sessionId, groupJid, userJid));
    await this.bus.emit('anti:warn_removed', { sessionId, groupJid, userJid, count: 0 });
  }

  // ── Query ────────────────────────────────────────────────────────────────

  getCount(sessionId: string, groupJid: string, userJid: string): number {
    return this.warns.get(this.key(sessionId, groupJid, userJid))?.length ?? 0;
  }

  getHistory(sessionId: string, groupJid: string, userJid: string): WarnRecord[] {
    return [...(this.warns.get(this.key(sessionId, groupJid, userJid)) ?? [])];
  }

  getAllInGroup(sessionId: string, groupJid: string): Array<{ userJid: string; count: number }> {
    const result: Array<{ userJid: string; count: number }> = [];
    for (const [k, records] of this.warns) {
      if (k.startsWith(`${sessionId}:${groupJid}:`) && records.length > 0) {
        const userJid = k.split(':').slice(2).join(':');
        result.push({ userJid, count: records.length });
      }
    }
    return result;
  }
}
