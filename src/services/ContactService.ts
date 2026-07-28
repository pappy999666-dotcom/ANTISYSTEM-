/**
 * PAPPYBOT V2 — Contact Service
 *
 * Manages contact information retrieval and caching.
 * Wraps @crysnovax/baileys contact APIs and the ContactCache.
 *
 * Extension points:
 *   - Future prompt: expose contact data via web dashboard.
 *   - Future prompt: sync contacts to database for persistence.
 */

import type { SocketManager } from '../whatsapp/SocketManager';
import type { ContactCache } from '../whatsapp/ContactCache';
import type { EventBus } from '../events/EventBus';
import type { CachedContact, ContactProfile } from '../types/Contact';
import { normalizeJid } from '../utils/jid';
import { logger } from '../logger/Logger';

const log = logger.child('ContactService');

export class ContactService {
  private readonly socketManager: SocketManager;
  private readonly contactCache: ContactCache;
  private readonly bus: EventBus;

  constructor(socketManager: SocketManager, contactCache: ContactCache, bus: EventBus) {
    this.socketManager = socketManager;
    this.contactCache = contactCache;
    this.bus = bus;
  }

  // ── Contact lookup ────────────────────────────────────────────────────

  /**
   * Get a contact's cached info. Returns undefined if not cached.
   */
  getCached(jid: string): CachedContact | undefined {
    return this.contactCache.get(normalizeJid(jid));
  }

  /**
   * Get the best display name for a JID.
   * Falls back to the phone number part of the JID.
   */
  getDisplayName(jid: string): string {
    return this.contactCache.getDisplayName(normalizeJid(jid));
  }

  /**
   * Get all cached contacts.
   */
  getAllCached(): CachedContact[] {
    return this.contactCache.getAll();
  }

  // ── Profile data ──────────────────────────────────────────────────────

  /**
   * Fetch a contact's status text from WhatsApp.
   */
  async fetchStatus(sessionId: string, jid: string): Promise<string | undefined> {
    const normalized = normalizeJid(jid);
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await sock.fetchStatus(normalized) as Record<string, unknown> | undefined;
      const status = result?.['status'] as string | undefined;
      return status;
    } catch (err) {
      log.warn('Failed to fetch status', { sessionId, jid: normalized, error: String(err) });
      return undefined;
    }
  }

  /**
   * Fetch a contact's profile picture URL.
   * Returns undefined if no picture or not accessible.
   */
  async fetchProfilePicture(sessionId: string, jid: string, hq = false): Promise<string | undefined> {
    const normalized = normalizeJid(jid);
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const url = await sock.profilePictureUrl(normalized, hq ? 'image' : 'preview') as string | undefined;
      return url;
    } catch (err) {
      // Privacy settings or no profile picture — not an error condition
      log.trace('Profile picture not available', { sessionId, jid: normalized });
      return undefined;
    }
  }

  /**
   * Build a full ContactProfile for a JID (status + picture + cached name).
   */
  async getProfile(sessionId: string, jid: string): Promise<ContactProfile> {
    const normalized = normalizeJid(jid);
    const cached = this.contactCache.get(normalized);

    const [statusText, profilePictureUrl] = await Promise.allSettled([
      this.fetchStatus(sessionId, normalized),
      this.fetchProfilePicture(sessionId, normalized),
    ]);

    return {
      jid: normalized,
      pushName: cached?.pushName,
      statusText: statusText.status === 'fulfilled' ? statusText.value : undefined,
      profilePictureUrl: profilePictureUrl.status === 'fulfilled' ? profilePictureUrl.value : undefined,
    };
  }

  // ── Block list ────────────────────────────────────────────────────────

  /**
   * Fetch the current account's block list.
   */
  async getBlockList(sessionId: string): Promise<string[]> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const list = await sock.fetchBlocklist() as string[];
      return list.map(normalizeJid);
    } catch (err) {
      log.error('Failed to fetch block list', { sessionId, error: String(err) });
      throw err;
    }
  }

  /**
   * Block or unblock a contact.
   */
  async updateBlock(sessionId: string, jid: string, action: 'block' | 'unblock'): Promise<void> {
    const normalized = normalizeJid(jid);
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.updateBlockStatus(normalized, action);
      log.info('Block status updated', { sessionId, jid: normalized, action });
    } catch (err) {
      log.error('Failed to update block status', { sessionId, jid: normalized, action, error: String(err) });
      throw err;
    }
  }

  // ── Cache management ──────────────────────────────────────────────────

  /**
   * Update the cache from a Baileys `contacts.upsert` event payload.
   */
  handleContactsUpsert(rawContacts: Array<Record<string, unknown>>): void {
    this.contactCache.upsertRaw(rawContacts);
    for (const raw of rawContacts) {
      const jid = raw['id'] as string | undefined;
      if (jid) {
        this.bus.emit('contact:upserted', { sessionId: '', jid: normalizeJid(jid) }).catch(() => undefined);
      }
    }
  }

  /**
   * Update push name from an incoming message.
   */
  updatePushNameFromMessage(jid: string, pushName: string | undefined): void {
    this.contactCache.updatePushName(normalizeJid(jid), pushName);
  }

  /**
   * Directly set or merge contact info.
   */
  upsertContact(contact: Omit<CachedContact, 'cachedAt'>): void {
    this.contactCache.set(contact);
  }

  invalidate(jid: string): void {
    this.contactCache.invalidate(normalizeJid(jid));
  }

  clearAll(): void {
    this.contactCache.clear();
  }
}
