/**
 * PAPPYBOT V2 — Group Engine
 *
 * Central orchestrator for all group management operations.
 * Every group-related command calls this engine — never the socket directly.
 *
 * Responsibilities:
 *   - Group metadata, settings, picture, subject, description
 *   - Invite management
 *   - Create group wizard
 *   - Participant management (delegates to ParticipantEngine)
 *   - Welcome/Goodbye (delegates to WelcomeEngine)
 *   - Tag (delegates to TagEngine)
 *   - Admin protection (delegates to AdminProtectionEngine)
 */

import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { ContactCache } from '../../whatsapp/ContactCache';
import type { EventBus } from '../../events/EventBus';
import type { GroupMetadata } from '../../types/Group';
import { ParticipantEngine } from './ParticipantEngine';
import { TagEngine } from './TagEngine';
import { WelcomeEngine } from './WelcomeEngine';
import { AdminProtectionEngine } from './AdminProtectionEngine';
import { GroupTemplateEngine } from './GroupTemplateEngine';
import { GroupHistoryService } from '../services/GroupHistoryService';
import { IntroCardService } from '../services/IntroCardService';
import { normalizeJid } from '../../utils/jid';
import { logger } from '../../logger/Logger';

const log = logger.child('GroupEngine');

export class GroupEngine {
  readonly participants: ParticipantEngine;
  readonly tag: TagEngine;
  readonly welcome: WelcomeEngine;
  readonly adminProtection: AdminProtectionEngine;
  readonly templates: GroupTemplateEngine;
  readonly history: GroupHistoryService;
  readonly introCards: IntroCardService;

  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache,
    private readonly contactCache: ContactCache,
    private readonly bus: EventBus
  ) {
    this.templates = new GroupTemplateEngine();
    this.history = new GroupHistoryService();
    this.introCards = new IntroCardService();
    this.participants = new ParticipantEngine(socketManager, groupCache, contactCache, bus);
    this.tag = new TagEngine(socketManager, groupCache);
    this.welcome = new WelcomeEngine(socketManager, groupCache, bus, this.templates, this.introCards);
    this.adminProtection = new AdminProtectionEngine(socketManager, groupCache, bus);
  }

  // ── Metadata ─────────────────────────────────────────────────────────────

  async getMetadata(sessionId: string, groupJid: string, forceRefresh = false): Promise<GroupMetadata | undefined> {
    if (!forceRefresh) {
      const cached = this.groupCache.get(groupJid);
      if (cached) return cached;
    }
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return undefined;
    try {
      const raw = await sock.groupMetadata(groupJid) as Record<string, unknown>;
      const meta = this.normalizeMetadata(raw);
      this.groupCache.set(meta);
      return meta;
    } catch (err) {
      log.error('Failed to fetch group metadata', { sessionId, groupJid, error: String(err) });
      return undefined;
    }
  }

  // ── Create Group ──────────────────────────────────────────────────────────

  async createGroup(
    sessionId: string,
    subject: string,
    participants: string[],
    opts: { description?: string; imageBuffer?: Buffer; promotionTarget?: string; creatorJid?: string } = {}
  ): Promise<{ groupJid: string; inviteLink?: string; historyId: string }> {
    const sock = this.socketManager.requireSocket(sessionId);

    const historyRecord = this.history.create({
      sessionId,
      groupJid: '',
      groupName: subject,
      description: opts.description,
      creatorJid: opts.creatorJid ?? '',
      promotionTarget: opts.promotionTarget,
    });

    try {
      const result = await sock.groupCreate(subject, participants.map(normalizeJid)) as Record<string, unknown>;
      const groupJid = normalizeJid((result['id'] ?? result['gid']) as string ?? '');

      this.history.updateStatus(historyRecord.id, 'created', groupJid);

      // Apply description
      if (opts.description) {
        await this.setDescription(sessionId, groupJid, opts.description).catch(() => undefined);
      }

      // Apply picture
      if (opts.imageBuffer) {
        await this.setGroupPicture(sessionId, groupJid, opts.imageBuffer).catch(() => undefined);
      }

      // Get invite link
      let inviteLink: string | undefined;
      try {
        const code = await sock.groupInviteCode(groupJid) as string;
        inviteLink = `https://chat.whatsapp.com/${code}`;
        this.history.updateStatus(historyRecord.id, 'created', groupJid, inviteLink);
      } catch { /* non-critical */ }

      // Promote target if provided
      if (opts.promotionTarget) {
        const targetJid = normalizeJid(opts.promotionTarget);
        await this.participants.promote(sessionId, groupJid, targetJid).catch(() => undefined);
      }

      await this.bus.emit('group:created', { sessionId, groupJid, subject } as never);
      log.info('Group created', { sessionId, groupJid, subject });

      return { groupJid, inviteLink, historyId: historyRecord.id };
    } catch (err) {
      this.history.updateStatus(historyRecord.id, 'failed');
      log.error('Failed to create group', { sessionId, error: String(err) });
      throw err;
    }
  }

  // ── Picture ───────────────────────────────────────────────────────────────

  async setGroupPicture(sessionId: string, groupJid: string, imageBuffer: Buffer): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    await sock.updateProfilePicture(groupJid, imageBuffer);
    await this.bus.emit('group:picture_changed', { sessionId, groupJid } as never);
    log.info('Group picture updated', { sessionId, groupJid });
  }

  async setProfilePicture(sessionId: string, imageBuffer: Buffer): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    const botJid = normalizeJid((sock.user?.id as string) ?? '');
    await sock.updateProfilePicture(botJid, imageBuffer);
    await this.bus.emit('profile:picture_updated', { sessionId, jid: botJid });
    log.info('Profile picture updated', { sessionId });
  }

  // ── Subject / Description ─────────────────────────────────────────────────

  async setSubject(sessionId: string, groupJid: string, subject: string): Promise<void> {
    if (!subject.trim()) throw new Error('Subject cannot be empty');
    if (subject.length > 100) throw new Error('Subject too long (max 100 characters)');
    const sock = this.socketManager.requireSocket(sessionId);
    await sock.groupUpdateSubject(groupJid, subject);
    this.groupCache.patch(groupJid, { subject });
    await this.bus.emit('group:subject_changed', { sessionId, groupJid, subject } as never);
    log.info('Group subject updated', { sessionId, groupJid, subject });
  }

  async setDescription(sessionId: string, groupJid: string, description: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    await sock.groupUpdateDescription(groupJid, description);
    this.groupCache.patch(groupJid, { description });
    await this.bus.emit('group:description_changed', { sessionId, groupJid } as never);
    log.info('Group description updated', { sessionId, groupJid });
  }

  // ── Invite ────────────────────────────────────────────────────────────────

  async getInviteLink(sessionId: string, groupJid: string): Promise<string> {
    const cached = this.groupCache.get(groupJid);
    if (cached?.inviteCode) return `https://chat.whatsapp.com/${cached.inviteCode}`;
    const sock = this.socketManager.requireSocket(sessionId);
    const code = await sock.groupInviteCode(groupJid) as string;
    this.groupCache.patch(groupJid, { inviteCode: code });
    return `https://chat.whatsapp.com/${code}`;
  }

  async revokeInviteLink(sessionId: string, groupJid: string): Promise<string> {
    const sock = this.socketManager.requireSocket(sessionId);
    const code = await sock.groupRevokeInvite(groupJid) as string;
    this.groupCache.patch(groupJid, { inviteCode: code });
    return `https://chat.whatsapp.com/${code}`;
  }

  // ── Leave ─────────────────────────────────────────────────────────────────

  async leaveGroup(sessionId: string, groupJid: string): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    await sock.groupLeave(groupJid);
    this.groupCache.invalidate(groupJid);
        await this.bus.emit('group:updated', { sessionId, groupJid });
            log.info('Left group', { sessionId, groupJid });
              }

                // ── Settings ──────────────────────────────────────────────────────────────

                  async setAnnounce(sessionId: string, groupJid: string, enable: boolean): Promise<void> {
                      const sock = this.socketManager.requireSocket(sessionId);
                          await sock.groupSettingUpdate(groupJid, enable ? 'announcement' : 'not_announcement');
                              this.groupCache.patch(groupJid, { announce: enable });
                                  await this.bus.emit('group:updated', { sessionId, groupJid });
                                    }

                                      async setRestrict(sessionId: string, groupJid: string, enable: boolean): Promise<void> {
                                          const sock = this.socketManager.requireSocket(sessionId);
                                              await sock.groupSettingUpdate(groupJid, enable ? 'locked' : 'unlocked');
                                                  this.groupCache.patch(groupJid, { restrict: enable });
                                                      await this.bus.emit('group:updated', { sessionId, groupJid });
                                                        }

                                                          async setJoinApproval(sessionId: string, groupJid: string, enable: boolean): Promise<void> {
                                                              const sock = this.socketManager.requireSocket(sessionId);
                                                                  await sock.groupMemberAddMode(groupJid, enable ? 'approval' : 'all_member_add');
                                                                      this.groupCache.patch(groupJid, { joinApprovalMode: enable });
                                                                          await this.bus.emit('group:updated', { sessionId, groupJid });
                                                                            }

                                                                              async setDisappearingMessages(sessionId: string, groupJid: string, duration: number): Promise<void> {
                                                                                  const sock = this.socketManager.requireSocket(sessionId);
                                                                                      await sock.groupToggleEphemeral(groupJid, duration);
                                                                                          this.groupCache.patch(groupJid, { ephemeralDuration: duration });
                                                                                              await this.bus.emit('group:updated', { sessionId, groupJid });
                                                                                                }

                                                                                                  // ── Profile info ──────────────────────────────────────────────────────────

                                                                                                    async fetchProfilePicture(sessionId: string, jid: string): Promise<string | undefined> {
                                                                                                        const sock = this.socketManager.getSocket(sessionId);
                                                                                                            if (!sock) return undefined;
                                                                                                                try {
                                                                                                                      return await sock.profilePictureUrl(normalizeJid(jid), 'image') as string;
                                                                                                                          } catch { return undefined; }
                                                                                                                            }

                                                                                                                              async fetchStatus(sessionId: string, jid: string): Promise<string | undefined> {
                                                                                                                                  const sock = this.socketManager.getSocket(sessionId);
                                                                                                                                      if (!sock) return undefined;
                                                                                                                                          try {
                                                                                                                                                const r = await sock.fetchStatus(normalizeJid(jid)) as Record<string, unknown> | undefined;
                                                                                                                                                      return r?.['status'] as string | undefined;
                                                                                                                                                          } catch { return undefined; }
                                                                                                                                                            }

                                                                                                                                                              // ── Private ───────────────────────────────────────────────────────────────

                                                                                                                                                                private normalizeMetadata(raw: Record<string, unknown>): GroupMetadata {
                                                                                                                                                                    const rawParticipants = (raw['participants'] as Array<Record<string, unknown>>) ?? [];
                                                                                                                                                                        return {
                                                                                                                                                                              id: normalizeJid(raw['id'] as string ?? ''),
                                                                                                                                                                                    subject: raw['subject'] as string ?? '',
                                                                                                                                                                                          description: raw['desc'] as string | undefined,
                                                                                                                                                                                                owner: raw['owner'] ? normalizeJid(raw['owner'] as string) : undefined,
                                                                                                                                                                                                      participants: rawParticipants.map(p => ({
                                                                                                                                                                                                              jid: normalizeJid(p['id'] as string ?? ''),
                                                                                                                                                                                                                      isAdmin: (p['admin'] as string | undefined) === 'admin' || (p['admin'] as string | undefined) === 'superadmin',
                                                                                                                                                                                                                              isSuperAdmin: (p['admin'] as string | undefined) === 'superadmin',
                                                                                                                                                                                                                                    })),
                                                                                                                                                                                                                                          announce: (raw['announce'] as boolean | undefined) ?? false,
                                                                                                                                                                                                                                                restrict: (raw['restrict'] as boolean | undefined) ?? false,
                                                                                                                                                                                                                                                      ephemeralDuration: raw['ephemeralDuration'] as number | undefined,
                                                                                                                                                                                                                                                            cachedAt: Date.now(),
                                                                                                                                                                                                                                                                };
                                                                                                                                                                                                                                                                  }
                                                                                                                                                                                                                                                                  }
