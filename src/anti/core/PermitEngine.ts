/**
 * PAPPYBOT V2 — Permit Engine
 *
 * Shared permit/whitelist system used by every anti feature.
 * A permit exempts a user from a specific detector (or all detectors)
 * in a specific group (or all groups in a session).
 *
 * Permit hierarchy (any match = permitted):
 *   1. Owner JID
 *   2. Session owner JID (bot account)
 *   3. Sudo JIDs
 *   4. Group admins (if adminBypass is enabled for the detector)
 *   5. Explicit permit record
 *
 * All permits are stored in memory with O(1) lookup.
 * Future prompt: persist to DatabaseManager.
 */

import type { Permit, DetectorId } from '../types/Anti';
import type { GroupCache } from '../../whatsapp/GroupCache';
import { logger } from '../../logger/Logger';
import { v4 as uuidv4 } from 'uuid';

const log = logger.child('PermitEngine');

export class PermitEngine {
  /**
   * key: `${sessionId}:${groupJid}:${jid}:${detectorId}`
   * We also store wildcard keys for fast lookup.
   */
  private readonly permits = new Map<string, Permit>();

  // ── Check ────────────────────────────────────────────────────────────────

  /**
   * Returns true if the user is permitted (exempt) from the given detector
   * in the given group. Checks all bypass levels.
   */
  isPermitted(opts: {
    sessionId: string;
    groupJid: string;
    senderJid: string;
    detectorId: DetectorId;
    ownerJid: string;
    botJid: string;
    sudoJids: string[];
    groupCache?: GroupCache;
    adminBypass?: boolean;
  }): boolean {
    const { sessionId, groupJid, senderJid, detectorId, ownerJid, botJid, sudoJids, groupCache, adminBypass } = opts;

    // Owner / bot / sudo always bypass
    if (senderJid === ownerJid || senderJid === botJid) return true;
    if (sudoJids.includes(senderJid)) return true;

    // Admin bypass (if enabled for this detector)
    if (adminBypass && groupCache?.isAdmin(groupJid, senderJid)) return true;

    // Explicit permit — check specific detector, then wildcard
    return (
      this.hasPermit(sessionId, groupJid, senderJid, detectorId) ||
      this.hasPermit(sessionId, groupJid, senderJid, '*') ||
      this.hasPermit(sessionId, '*', senderJid, detectorId) ||
      this.hasPermit(sessionId, '*', senderJid, '*')
    );
  }

  private hasPermit(sessionId: string, groupJid: string, jid: string, detectorId: DetectorId | '*'): boolean {
    const permit = this.permits.get(this.key(sessionId, groupJid, jid, detectorId));
    if (!permit) return false;
    if (permit.expiresAt && Date.now() > permit.expiresAt) {
      this.permits.delete(this.key(sessionId, groupJid, jid, detectorId));
      return false;
    }
    return true;
  }

  // ── Add / Remove ─────────────────────────────────────────────────────────

  add(permit: Omit<Permit, 'createdAt'>): Permit {
    const full: Permit = { ...permit, createdAt: Date.now() };
    this.permits.set(this.key(full.sessionId, full.groupJid, full.jid, full.detectorId), full);
    log.debug('Permit added', { jid: full.jid, detectorId: full.detectorId, groupJid: full.groupJid });
    return full;
  }

  remove(sessionId: string, groupJid: string, jid: string, detectorId: DetectorId | '*'): boolean {
    const deleted = this.permits.delete(this.key(sessionId, groupJid, jid, detectorId));
    if (deleted) log.debug('Permit removed', { jid, detectorId, groupJid });
    return deleted;
  }

  /** Remove all permits for a user in a group */
  removeAll(sessionId: string, groupJid: string, jid: string): number {
    let count = 0;
    for (const [k, p] of this.permits) {
      if (p.sessionId === sessionId && p.groupJid === groupJid && p.jid === jid) {
        this.permits.delete(k);
        count++;
      }
    }
    return count;
  }

  // ── Query ────────────────────────────────────────────────────────────────

  getForUser(sessionId: string, groupJid: string, jid: string): Permit[] {
    return [...this.permits.values()].filter(
      p => p.sessionId === sessionId && (p.groupJid === groupJid || p.groupJid === '*') && p.jid === jid
    );
  }

  getForGroup(sessionId: string, groupJid: string): Permit[] {
    return [...this.permits.values()].filter(
      p => p.sessionId === sessionId && (p.groupJid === groupJid || p.groupJid === '*')
    );
  }

  /** Prune expired permits */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [k, p] of this.permits) {
      if (p.expiresAt && now > p.expiresAt) {
        this.permits.delete(k);
        pruned++;
      }
    }
    return pruned;
  }

  count(): number { return this.permits.size; }

  // ── Helpers ──────────────────────────────────────────────────────────────

  /** Build a permit ID */
  static newId(): string { return uuidv4(); }

  private key(sessionId: string, groupJid: string, jid: string, detectorId: DetectorId | '*'): string {
    return `${sessionId}:${groupJid}:${jid}:${detectorId}`;
  }
}
