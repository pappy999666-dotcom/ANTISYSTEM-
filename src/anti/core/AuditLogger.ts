/**
 * PAPPYBOT V2 — Anti Audit Logger
 *
 * Every anti action generates a structured audit record.
 * Records are kept in a bounded in-memory ring buffer per group.
 * Future prompt: flush to DatabaseManager for persistence.
 */

import type { AuditRecord, DetectorId, ActionType } from '../types/Anti';
import { logger } from '../../logger/Logger';
import { v4 as uuidv4 } from 'uuid';

const log = logger.child('AuditLogger');
const MAX_RECORDS_PER_GROUP = 500;

export class AuditLogger {
  /** key: `${sessionId}:${groupJid}` → ring buffer */
  private readonly records = new Map<string, AuditRecord[]>();

  record(opts: Omit<AuditRecord, 'id' | 'timestamp'>): AuditRecord {
    const record: AuditRecord = {
      id: uuidv4(),
      timestamp: Date.now(),
      ...opts,
    };

    const k = `${opts.sessionId}:${opts.groupJid}`;
    let buf = this.records.get(k);
    if (!buf) { buf = []; this.records.set(k, buf); }

    buf.push(record);
    if (buf.length > MAX_RECORDS_PER_GROUP) buf.shift();

    log.trace('Audit record', {
      group: opts.groupJid,
      sender: opts.senderJid,
      detector: opts.detectorId,
      action: opts.action,
    });

    return record;
  }

  getForGroup(sessionId: string, groupJid: string, limit = 50): AuditRecord[] {
    const buf = this.records.get(`${sessionId}:${groupJid}`) ?? [];
    return buf.slice(-limit);
  }

  getForUser(sessionId: string, groupJid: string, userJid: string, limit = 20): AuditRecord[] {
    return this.getForGroup(sessionId, groupJid, MAX_RECORDS_PER_GROUP)
      .filter(r => r.senderJid === userJid)
      .slice(-limit);
  }

  clear(sessionId: string, groupJid: string): void {
    this.records.delete(`${sessionId}:${groupJid}`);
  }

  totalRecords(): number {
    let n = 0;
    for (const buf of this.records.values()) n += buf.length;
    return n;
  }
}
