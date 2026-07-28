/**
 * PAPPYBOT V2 — Anti Stats Manager
 *
 * Tracks per-group, per-session anti system metrics.
 * All counters are in-memory. Future prompt: persist snapshots.
 */

import type { AntiStats, DetectorId, ActionType } from '../types/Anti';

export class StatsManager {
  private readonly stats = new Map<string, AntiStats>();

  private key(sessionId: string, groupJid: string): string {
    return `${sessionId}:${groupJid}`;
  }

  private get(sessionId: string, groupJid: string): AntiStats {
    const k = this.key(sessionId, groupJid);
    let s = this.stats.get(k);
    if (!s) {
      s = { sessionId, groupJid, detections: {}, actions: {}, permits: 0, warns: 0, kicks: 0, bans: 0, lastReset: Date.now() };
      this.stats.set(k, s);
    }
    return s;
  }

  recordDetection(sessionId: string, groupJid: string, detectorId: DetectorId): void {
    const s = this.get(sessionId, groupJid);
    s.detections[detectorId] = (s.detections[detectorId] ?? 0) + 1;
  }

  recordAction(sessionId: string, groupJid: string, action: ActionType): void {
    const s = this.get(sessionId, groupJid);
    s.actions[action] = (s.actions[action] ?? 0) + 1;
    if (action === 'warn' || action === 'delete+warn') s.warns++;
    if (action === 'kick' || action === 'delete+kick') s.kicks++;
    if (action === 'ban') s.bans++;
  }

  recordPermit(sessionId: string, groupJid: string): void {
    this.get(sessionId, groupJid).permits++;
  }

  snapshot(sessionId: string, groupJid: string): AntiStats {
    return { ...this.get(sessionId, groupJid) };
  }

  reset(sessionId: string, groupJid: string): void {
    const s = this.get(sessionId, groupJid);
    s.detections = {};
    s.actions = {};
    s.permits = 0;
    s.warns = 0;
    s.kicks = 0;
    s.bans = 0;
    s.lastReset = Date.now();
  }

  getAllSnapshots(): AntiStats[] {
    return [...this.stats.values()].map(s => ({ ...s }));
  }
}
