/**
 * PAPPYBOT V2 — Profile Service
 *
 * Handles the session account's own WhatsApp profile operations:
 *   - Fetching profile picture
 *   - Updating profile picture
 *   - Updating profile name
 *   - Fetching profile/status information
 *
 * These are service foundations for future command prompts.
 *
 * Extension points:
 *   - Future prompt: expose via !profile commands.
 *   - Future prompt: wire to web dashboard for remote profile management.
 */

import type { SocketManager } from '../whatsapp/SocketManager';
import type { EventBus } from '../events/EventBus';
import { normalizeJid } from '../utils/jid';
import { logger } from '../logger/Logger';

const log = logger.child('ProfileService');

export interface ProfileInfo {
  jid: string;
  name?: string;
  statusText?: string;
  profilePictureUrl?: string;
}

export class ProfileService {
  private readonly socketManager: SocketManager;
  private readonly bus: EventBus;

  constructor(socketManager: SocketManager, bus: EventBus) {
    this.socketManager = socketManager;
    this.bus = bus;
  }

  // ── Own profile ───────────────────────────────────────────────────────

  /**
   * Get the session account's own profile info (name, status).
   */
  async getOwnProfile(sessionId: string): Promise<ProfileInfo> {
    const sock = this.socketManager.requireSocket(sessionId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = sock.user as Record<string, unknown> | undefined;
    const jid = user ? normalizeJid(user['id'] as string ?? '') : '';
    const name = user?.['name'] as string | undefined;

    const [status, pictureUrl] = await Promise.allSettled([
      this.fetchStatus(sessionId, jid),
      this.fetchProfilePicture(sessionId, jid),
    ]);

    return {
      jid,
      name,
      statusText: status.status === 'fulfilled' ? status.value : undefined,
      profilePictureUrl: pictureUrl.status === 'fulfilled' ? pictureUrl.value : undefined,
    };
  }

  // ── Profile picture ───────────────────────────────────────────────────

  /**
   * Fetch a profile picture URL for any JID (own or contact).
   * Returns undefined if no picture is available or privacy prevents access.
   */
  async fetchProfilePicture(sessionId: string, jid: string, hq = false): Promise<string | undefined> {
    const normalized = normalizeJid(jid);
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const url = await sock.profilePictureUrl(normalized, hq ? 'image' : 'preview') as string | undefined;
      return url;
    } catch {
      return undefined;
    }
  }

  /**
   * Update the session account's own profile picture.
   * @param image - JPEG buffer (WhatsApp requirement).
   */
  async updateProfilePicture(sessionId: string, image: Buffer): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const user = sock.user as Record<string, unknown> | undefined;
    const jid = user ? normalizeJid(user['id'] as string ?? '') : '';

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.updateProfilePicture(jid, image);
      await this.bus.emit('profile:picture_updated', { sessionId, jid });
      log.info('Profile picture updated', { sessionId, jid });
    } catch (err) {
      log.error('Failed to update profile picture', { sessionId, jid, error: String(err) });
      throw err;
    }
  }

  /**
   * Update the session account's display name.
   */
  async updateProfileName(sessionId: string, name: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.updateProfileName(name);
      await this.bus.emit('profile:updated', {
        sessionId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        jid: normalizeJid((sock.user as Record<string, unknown>)?.['id'] as string ?? ''),
      });
      log.info('Profile name updated', { sessionId, name });
    } catch (err) {
      log.error('Failed to update profile name', { sessionId, error: String(err) });
      throw err;
    }
  }

  /**
   * Update the session account's status text.
   */
  async updateStatus(sessionId: string, statusText: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.updateProfileStatus(statusText);
      log.info('Profile status updated', { sessionId });
    } catch (err) {
      log.error('Failed to update profile status', { sessionId, error: String(err) });
      throw err;
    }
  }

  // ── Any JID profile ───────────────────────────────────────────────────

  /**
   * Fetch the status text for any JID.
   */
  async fetchStatus(sessionId: string, jid: string): Promise<string | undefined> {
    const normalized = normalizeJid(jid);
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await sock.fetchStatus(normalized) as Record<string, unknown> | undefined;
      return result?.['status'] as string | undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a phone number is registered on WhatsApp.
   * @param phoneNumber - E.164 format without '+', e.g. "15551234567"
   */
  async isOnWhatsApp(sessionId: string, phoneNumber: string): Promise<boolean> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const results = await sock.onWhatsApp(phoneNumber) as Array<Record<string, unknown>>;
      return results?.some(r => r['exists'] === true) ?? false;
    } catch {
      return false;
    }
  }
}
