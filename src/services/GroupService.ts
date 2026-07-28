/**
 * PAPPYBOT V2 — Group Service
 *
 * Reusable service methods for all supported WhatsApp group operations.
 * Uses SocketManager to access live sockets and GroupCache for efficient
 * metadata retrieval.
 *
 * Extension points:
 *   - Future prompt: expose these via bot commands.
 *   - Future prompt: wire group events to update cache automatically.
 */

import type { SocketManager } from '../whatsapp/SocketManager';
import type { GroupCache } from '../whatsapp/GroupCache';
import type { EventBus } from '../events/EventBus';
import type { GroupMetadata, GroupParticipant, GroupCreateOptions } from '../types/Group';
import { normalizeJid } from '../utils/jid';
import { logger } from '../logger/Logger';

const log = logger.child('GroupService');

export class GroupService {
  private readonly socketManager: SocketManager;
  private readonly groupCache: GroupCache;
  private readonly bus: EventBus;

  constructor(socketManager: SocketManager, groupCache: GroupCache, bus: EventBus) {
    this.socketManager = socketManager;
    this.groupCache = groupCache;
    this.bus = bus;
  }

  // ── Metadata ──────────────────────────────────────────────────────────

  /**
   * Fetch group metadata. Returns cached data if fresh; fetches from
   * WhatsApp otherwise.
   */
  async getMetadata(sessionId: string, groupJid: string, forceRefresh = false): Promise<GroupMetadata> {
    if (!forceRefresh) {
      const cached = this.groupCache.get(groupJid);
      if (cached) return cached;
    }

    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const raw = await sock.groupMetadata(groupJid) as Record<string, unknown>;
      const meta = this.normalizeMetadata(raw);
      this.groupCache.set(meta);
      return meta;
    } catch (err) {
      log.error('Failed to fetch group metadata', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  /**
   * Fetch all groups the session account is participating in.
   */
  async getAllParticipating(sessionId: string): Promise<GroupMetadata[]> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const raw = await sock.groupFetchAllParticipating() as Record<string, Record<string, unknown>>;
      const groups: GroupMetadata[] = [];
      for (const groupRaw of Object.values(raw)) {
        const meta = this.normalizeMetadata(groupRaw);
        this.groupCache.set(meta);
        groups.push(meta);
      }
      log.debug('Fetched all participating groups', { sessionId, count: groups.length });
      return groups;
    } catch (err) {
      log.error('Failed to fetch participating groups', { sessionId, error: String(err) });
      throw err;
    }
  }

  // ── Create / Leave ────────────────────────────────────────────────────

  /**
   * Create a new WhatsApp group.
   */
  async createGroup(sessionId: string, options: GroupCreateOptions): Promise<string> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await sock.groupCreate(
        options.subject,
        options.participants.map(normalizeJid)
      ) as Record<string, unknown>;

      const groupJid = result['id'] as string ?? result['gid'] as string ?? '';
      log.info('Group created', { sessionId, groupJid, subject: options.subject });
      await this.bus.emit('group:upserted', { sessionId, groupJid });
      return groupJid;
    } catch (err) {
      log.error('Failed to create group', { sessionId, error: String(err) });
      throw err;
    }
  }

  /**
   * Leave a group.
   */
  async leaveGroup(sessionId: string, groupJid: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupLeave(groupJid);
      this.groupCache.invalidate(groupJid);
      log.info('Left group', { sessionId, groupJid });
    } catch (err) {
      log.error('Failed to leave group', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  // ── Subject / Description ─────────────────────────────────────────────

  async updateSubject(sessionId: string, groupJid: string, subject: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupUpdateSubject(groupJid, subject);
      this.groupCache.patch(groupJid, { subject });
      await this.bus.emit('group:updated', { sessionId, groupJid });
      log.info('Group subject updated', { sessionId, groupJid, subject });
    } catch (err) {
      log.error('Failed to update group subject', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  async updateDescription(sessionId: string, groupJid: string, description: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupUpdateDescription(groupJid, description);
      this.groupCache.patch(groupJid, { description });
      await this.bus.emit('group:updated', { sessionId, groupJid });
      log.info('Group description updated', { sessionId, groupJid });
    } catch (err) {
      log.error('Failed to update group description', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  // ── Group picture ─────────────────────────────────────────────────────

  async updateGroupPicture(sessionId: string, groupJid: string, image: Buffer): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.updateProfilePicture(groupJid, image);
      await this.bus.emit('group:updated', { sessionId, groupJid });
      log.info('Group picture updated', { sessionId, groupJid });
    } catch (err) {
      log.error('Failed to update group picture', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  // ── Participants ──────────────────────────────────────────────────────

  /**
   * Add, remove, promote, or demote participants.
   */
  async updateParticipants(
    sessionId: string,
    groupJid: string,
    action: 'add' | 'remove' | 'promote' | 'demote',
    participants: string[]
  ): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    const normalized = participants.map(normalizeJid);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupParticipantsUpdate(groupJid, normalized, action);

      // Update cache
      for (const jid of normalized) {
        if (action === 'add') {
          this.groupCache.addParticipant(groupJid, { jid, isAdmin: false, isSuperAdmin: false });
          await this.bus.emit('group:participant_added', { sessionId, groupJid, jid });
        } else if (action === 'remove') {
          this.groupCache.removeParticipant(groupJid, jid);
          await this.bus.emit('group:participant_removed', { sessionId, groupJid, jid });
        } else if (action === 'promote') {
          this.groupCache.promoteParticipant(groupJid, jid);
          await this.bus.emit('group:participant_promoted', { sessionId, groupJid, jid });
        } else if (action === 'demote') {
          this.groupCache.demoteParticipant(groupJid, jid);
          await this.bus.emit('group:participant_demoted', { sessionId, groupJid, jid });
        }
      }

      log.info('Group participants updated', { sessionId, groupJid, action, count: normalized.length });
    } catch (err) {
      log.error('Failed to update group participants', { sessionId, groupJid, action, error: String(err) });
      throw err;
    }
  }

  // ── Invite ────────────────────────────────────────────────────────────

  /**
   * Get the group invite link code.
   */
  async getInviteCode(sessionId: string, groupJid: string): Promise<string> {
    const cached = this.groupCache.get(groupJid);
    if (cached?.inviteCode) return cached.inviteCode;

    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const code = await sock.groupInviteCode(groupJid) as string;
      this.groupCache.patch(groupJid, { inviteCode: code });
      return code;
    } catch (err) {
      log.error('Failed to get invite code', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  /**
   * Revoke and regenerate the group invite link.
   */
  async revokeInviteCode(sessionId: string, groupJid: string): Promise<string> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const newCode = await sock.groupRevokeInvite(groupJid) as string;
      this.groupCache.patch(groupJid, { inviteCode: newCode });
      return newCode;
    } catch (err) {
      log.error('Failed to revoke invite code', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  /**
   * Accept a group invite by code and return the joined group JID.
   */
  async acceptInvite(sessionId: string, inviteCode: string): Promise<string> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const groupJid = await sock.groupAcceptInvite(inviteCode) as string;
      log.info('Accepted group invite', { sessionId, groupJid });
      return groupJid;
    } catch (err) {
      log.error('Failed to accept invite', { sessionId, error: String(err) });
      throw err;
    }
  }

  // ── Settings ──────────────────────────────────────────────────────────

  /**
   * Set announcement mode (only admins can send messages).
   */
  async setAnnounce(sessionId: string, groupJid: string, enable: boolean): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupSettingUpdate(groupJid, enable ? 'announcement' : 'not_announcement');
      this.groupCache.patch(groupJid, { announce: enable });
      await this.bus.emit('group:updated', { sessionId, groupJid });
      log.info('Group announce mode updated', { sessionId, groupJid, enable });
    } catch (err) {
      log.error('Failed to update announce mode', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  /**
   * Restrict group — only admins can edit group info.
   */
  async setRestrict(sessionId: string, groupJid: string, enable: boolean): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupSettingUpdate(groupJid, enable ? 'locked' : 'unlocked');
      this.groupCache.patch(groupJid, { restrict: enable });
      await this.bus.emit('group:updated', { sessionId, groupJid });
    } catch (err) {
      log.error('Failed to update restrict setting', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  /**
   * Configure disappearing messages for a group.
   * @param duration - Seconds. 0 to disable. Common values: 86400 (1d), 604800 (7d), 7776000 (90d).
   */
  async setDisappearingMessages(sessionId: string, groupJid: string, duration: number): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.groupToggleEphemeral(groupJid, duration);
      this.groupCache.patch(groupJid, { ephemeralDuration: duration });
      await this.bus.emit('group:updated', { sessionId, groupJid });
      log.info('Disappearing messages updated', { sessionId, groupJid, duration });
    } catch (err) {
      log.error('Failed to set disappearing messages', { sessionId, groupJid, error: String(err) });
      throw err;
    }
  }

  // ── Cache helpers ─────────────────────────────────────────────────────

  getCachedMetadata(groupJid: string): GroupMetadata | undefined {
    return this.groupCache.get(groupJid);
  }

  isAdmin(groupJid: string, jid: string): boolean {
    return this.groupCache.isAdmin(groupJid, normalizeJid(jid));
  }

  // ── Private ───────────────────────────────────────────────────────────

  private normalizeMetadata(raw: Record<string, unknown>): GroupMetadata {
    const rawParticipants = (raw['participants'] as Array<Record<string, unknown>>) ?? [];
    const participants: GroupParticipant[] = rawParticipants.map(p => ({
      jid: normalizeJid(p['id'] as string ?? ''),
      isAdmin: (p['admin'] as string | undefined) === 'admin' || (p['admin'] as string | undefined) === 'superadmin',
      isSuperAdmin: (p['admin'] as string | undefined) === 'superadmin',
    }));

    return {
      id: normalizeJid(raw['id'] as string ?? ''),
      subject: raw['subject'] as string ?? '',
      description: raw['desc'] as string | undefined,
      owner: raw['owner'] ? normalizeJid(raw['owner'] as string) : undefined,
      participants,
      announce: (raw['announce'] as boolean | undefined) ?? false,
      restrict: (raw['restrict'] as boolean | undefined) ?? false,
      ephemeralDuration: raw['ephemeralDuration'] as number | undefined,
      cachedAt: Date.now(),
    };
  }
}
