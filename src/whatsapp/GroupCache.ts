/**
 * PAPPYBOT V2 — Group Cache
 *
 * Per-session in-memory cache for WhatsApp group metadata.
 * Reduces redundant network requests to WhatsApp servers.
 *
 * Extension points:
 *   - Future prompt: back this with the DatabaseManager for persistence across restarts.
 */

import type { GroupMetadata, GroupParticipant } from '../types/Group';
import { logger } from '../logger/Logger';

const log = logger.child('GroupCache');

/** How long a cache entry is considered fresh (ms). Default: 5 minutes. */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

export class GroupCache {
  private readonly cache = new Map<string, GroupMetadata>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  /** Get cached metadata if it exists and is still fresh. */
  get(groupJid: string): GroupMetadata | undefined {
    const entry = this.cache.get(groupJid);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(groupJid);
      return undefined;
    }
    return entry;
  }

  /** Check whether a fresh entry exists without returning it. */
  has(groupJid: string): boolean {
    return this.get(groupJid) !== undefined;
  }

  getAdmin(groupJid: string): GroupParticipant[] {
    const meta = this.get(groupJid);
    return meta?.participants.filter(p => p.isAdmin) ?? [];
  }

  getSuperAdmins(groupJid: string): GroupParticipant[] {
    const meta = this.get(groupJid);
    return meta?.participants.filter(p => p.isSuperAdmin) ?? [];
  }

  isAdmin(groupJid: string, jid: string): boolean {
    const meta = this.get(groupJid);
    if (!meta) return false;
    return meta.participants.some(p => p.jid === jid && (p.isAdmin || p.isSuperAdmin));
  }

  isOwner(groupJid: string, jid: string): boolean {
    const meta = this.get(groupJid);
    return meta?.owner === jid;
  }

  getAllGroups(): GroupMetadata[] {
    const now = Date.now();
    const result: GroupMetadata[] = [];
    for (const [jid, meta] of this.cache) {
      if (now - meta.cachedAt <= this.ttlMs) {
        result.push(meta);
      } else {
        this.cache.delete(jid);
      }
    }
    return result;
  }

  // ── Write ───────────────────────────────────────────────────────────────

  /** Store or replace a group metadata entry. */
  set(metadata: Omit<GroupMetadata, 'cachedAt'> & { cachedAt?: number }): void {
    const entry: GroupMetadata = { ...metadata, cachedAt: metadata.cachedAt ?? Date.now() };
    this.cache.set(metadata.id, entry);
    log.trace('Group cached', { groupJid: metadata.id, participants: metadata.participants.length });
  }

  /** Merge a partial update into an existing cache entry (preserves participants etc.). */
  patch(groupJid: string, patch: Partial<Omit<GroupMetadata, 'id' | 'cachedAt'>>): void {
    const existing = this.cache.get(groupJid);
    if (!existing) return;
    Object.assign(existing, patch, { cachedAt: Date.now() });
  }

  /** Update participant list only (e.g. on group-participants.update event). */
  updateParticipants(groupJid: string, participants: GroupParticipant[]): void {
    const existing = this.cache.get(groupJid);
    if (existing) {
      existing.participants = participants;
      existing.cachedAt = Date.now();
    }
  }

  /** Add a single participant to the cached list. */
  addParticipant(groupJid: string, participant: GroupParticipant): void {
    const existing = this.cache.get(groupJid);
    if (!existing) return;
    const idx = existing.participants.findIndex(p => p.jid === participant.jid);
    if (idx >= 0) {
      existing.participants[idx] = participant;
    } else {
      existing.participants.push(participant);
    }
    existing.cachedAt = Date.now();
  }

  /** Remove a participant from the cached list. */
  removeParticipant(groupJid: string, jid: string): void {
    const existing = this.cache.get(groupJid);
    if (!existing) return;
    existing.participants = existing.participants.filter(p => p.jid !== jid);
    existing.cachedAt = Date.now();
  }

  /** Promote a participant to admin in the cached list. */
  promoteParticipant(groupJid: string, jid: string): void {
    const existing = this.cache.get(groupJid);
    if (!existing) return;
    const p = existing.participants.find(p => p.jid === jid);
    if (p) { p.isAdmin = true; }
    existing.cachedAt = Date.now();
  }

  /** Demote a participant from admin in the cached list. */
  demoteParticipant(groupJid: string, jid: string): void {
    const existing = this.cache.get(groupJid);
    if (!existing) return;
    const p = existing.participants.find(p => p.jid === jid);
    if (p) { p.isAdmin = false; p.isSuperAdmin = false; }
    existing.cachedAt = Date.now();
  }

  /** Evict a single group from the cache (force re-fetch on next access). */
  invalidate(groupJid: string): void {
    this.cache.delete(groupJid);
  }

  /** Clear all cached groups. */
  clear(): void {
    this.cache.clear();
    log.debug('Group cache cleared');
  }

  /** Total number of cached groups. */
  size(): number {
    return this.cache.size;
  }

  /** Evict all stale entries. */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [jid, meta] of this.cache) {
      if (now - meta.cachedAt > this.ttlMs) {
        this.cache.delete(jid);
        pruned++;
      }
    }
    return pruned;
  }
}
