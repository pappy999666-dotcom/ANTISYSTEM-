/**
 * PAPPYBOT V2 — Group History Service
 *
 * Maintains records of groups created by each session.
 * Supports revert of promotion target without recreating the group.
 * Future prompt: persist to DatabaseManager.
 */

import type { GroupHistoryRecord, GroupCreationStatus } from '../types/Group';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../logger/Logger';

const log = logger.child('GroupHistoryService');

export class GroupHistoryService {
  /** All records, keyed by internal ID */
  private readonly records = new Map<string, GroupHistoryRecord>();

  create(opts: Omit<GroupHistoryRecord, 'id' | 'createdAt' | 'status'>): GroupHistoryRecord {
    const record: GroupHistoryRecord = {
      id: uuidv4(),
      createdAt: Date.now(),
      status: 'pending',
      ...opts,
    };
    this.records.set(record.id, record);
    log.debug('Group history record created', { id: record.id, groupJid: record.groupJid });
    return record;
  }

  updateStatus(id: string, status: GroupCreationStatus, groupJid?: string, inviteLink?: string): void {
    const r = this.records.get(id);
    if (!r) return;
    r.status = status;
    if (groupJid) r.groupJid = groupJid;
    if (inviteLink) r.inviteLink = inviteLink;
  }

  /** Revert promotion target for a group record */
  revertPromotionTarget(id: string, newTarget: string | undefined): boolean {
    const r = this.records.get(id);
    if (!r) return false;
    r.promotionTarget = newTarget;
    log.debug('Promotion target reverted', { id, newTarget });
    return true;
  }

  getById(id: string): GroupHistoryRecord | undefined {
    return this.records.get(id);
  }

  getByGroupJid(sessionId: string, groupJid: string): GroupHistoryRecord | undefined {
    for (const r of this.records.values()) {
      if (r.sessionId === sessionId && r.groupJid === groupJid) return r;
    }
    return undefined;
  }

  getBySession(sessionId: string): GroupHistoryRecord[] {
    return [...this.records.values()]
      .filter(r => r.sessionId === sessionId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getAll(): GroupHistoryRecord[] {
    return [...this.records.values()].sort((a, b) => b.createdAt - a.createdAt);
  }
}
