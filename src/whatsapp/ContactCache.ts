/**
 * PAPPYBOT V2 — Contact Cache
 *
 * Per-session in-memory cache for WhatsApp contact metadata.
 * Stores push names and display names to avoid repeated network requests.
 *
 * Extension points:
 *   - Future prompt: persist to DatabaseManager for cross-restart retention.
 */

import type { CachedContact } from '../types/Contact';
import { logger } from '../logger/Logger';

const log = logger.child('ContactCache');

/** Cache TTL in ms — contact names rarely change. Default: 30 minutes. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

export class ContactCache {
  private readonly cache = new Map<string, CachedContact>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  get(jid: string): CachedContact | undefined {
    const entry = this.cache.get(jid);
    if (!entry) return undefined;
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(jid);
      return undefined;
    }
    return entry;
  }

  has(jid: string): boolean {
    return this.get(jid) !== undefined;
  }

  /** Best available display name for a JID. Falls back to the phone number portion. */
  getDisplayName(jid: string): string {
    const contact = this.get(jid);
    return contact?.displayName ?? contact?.pushName ?? jid.split('@')[0] ?? jid;
  }

  getAll(): CachedContact[] {
    const now = Date.now();
    const result: CachedContact[] = [];
    for (const [jid, contact] of this.cache) {
      if (now - contact.cachedAt <= this.ttlMs) {
        result.push(contact);
      } else {
        this.cache.delete(jid);
      }
    }
    return result;
  }

  // ── Write ───────────────────────────────────────────────────────────────

  set(contact: Omit<CachedContact, 'cachedAt'> & { cachedAt?: number }): void {
    const entry: CachedContact = { ...contact, cachedAt: contact.cachedAt ?? Date.now() };
    this.cache.set(contact.jid, entry);
    log.trace('Contact cached', { jid: contact.jid, pushName: contact.pushName });
  }

  /** Update only the fields provided. */
  patch(jid: string, patch: Partial<Omit<CachedContact, 'jid' | 'cachedAt'>>): void {
    const existing = this.cache.get(jid);
    if (existing) {
      Object.assign(existing, patch, { cachedAt: Date.now() });
    } else {
      this.set({ jid, ...patch });
    }
  }

  /**
   * Bulk upsert — typically called from the `contacts.upsert` Baileys event.
   * Raw contacts from Baileys look like: { id: string, notify?: string, name?: string }
   */
  upsertRaw(rawContacts: Array<Record<string, unknown>>): void {
    for (const raw of rawContacts) {
      const jid = raw['id'] as string | undefined;
      if (!jid) continue;
      this.patch(jid, {
        pushName: (raw['notify'] as string | undefined) ?? (raw['pushName'] as string | undefined),
        displayName: (raw['name'] as string | undefined) ?? (raw['verifiedName'] as string | undefined),
      });
    }
    log.trace('Bulk contacts upserted', { count: rawContacts.length });
  }

  /** Update a push name from an incoming message's pushName field. */
  updatePushName(jid: string, pushName: string | undefined): void {
    if (!pushName) return;
    this.patch(jid, { pushName });
  }

  invalidate(jid: string): void {
    this.cache.delete(jid);
  }

  clear(): void {
    this.cache.clear();
    log.debug('Contact cache cleared');
  }

  size(): number {
    return this.cache.size;
  }

  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [jid, contact] of this.cache) {
      if (now - contact.cachedAt > this.ttlMs) {
        this.cache.delete(jid);
        pruned++;
      }
    }
    return pruned;
  }
}
