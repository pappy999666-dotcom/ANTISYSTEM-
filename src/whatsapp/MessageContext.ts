/**
 * PAPPYBOT V2 — Message Context
 *
 * Wraps an ExtendedNormalizedMessage and exposes typed helper methods
 * for all common context lookups. Future anti-modules, commands, and
 * listeners use this instead of inspecting the raw message object.
 *
 * Extension points:
 *   - Add new helpers here as new message types are supported.
 *   - Wire into CommandContext so commands receive a MessageContext.
 */

import type { ExtendedNormalizedMessage } from './MessageNormalizer';
import type { GroupCache } from './GroupCache';
import type { MessageType } from '../types/Message';

export class MessageContext {
  constructor(
    private readonly msg: ExtendedNormalizedMessage,
    private readonly botJid: string,
    private readonly ownerJid: string,
    private readonly sudoJids: string[] = [],
    private readonly groupCache?: GroupCache
  ) {}

  // ── Identity ────────────────────────────────────────────────────────────

  get messageId(): string { return this.msg.id; }
  get sessionId(): string { return this.msg.sessionId; }
  get chatJid(): string { return this.msg.chatJid; }
  get senderJid(): string { return this.msg.sender.jid; }
  get senderPhone(): string { return this.msg.sender.phone; }
  get senderName(): string | undefined { return this.msg.sender.displayName; }
  get timestamp(): number { return this.msg.timestamp; }
  get messageType(): MessageType { return this.msg.type; }

  // ── Chat type ───────────────────────────────────────────────────────────

  isGroup(): boolean { return this.msg.chatType === 'group'; }
  isPrivate(): boolean { return this.msg.chatType === 'private'; }

  // ── Permissions ─────────────────────────────────────────────────────────

  isOwner(): boolean {
    return this.msg.sender.jid === this.ownerJid;
  }

  isSudo(): boolean {
    return this.isOwner() || this.sudoJids.includes(this.msg.sender.jid);
  }

  isSessionOwner(): boolean {
    return this.msg.sender.jid === this.botJid;
  }

  isAdmin(): boolean {
    if (!this.isGroup() || !this.groupCache) return false;
    return this.groupCache.isAdmin(this.msg.chatJid, this.msg.sender.jid);
  }

  isSuperAdmin(): boolean {
    if (!this.isGroup() || !this.groupCache) return false;
    const meta = this.groupCache.get(this.msg.chatJid);
    return meta?.participants.some(
      p => p.jid === this.msg.sender.jid && p.isSuperAdmin
    ) ?? false;
  }

  isBotAdmin(): boolean {
    if (!this.isGroup() || !this.groupCache) return false;
    return this.groupCache.isAdmin(this.msg.chatJid, this.botJid);
  }

  // ── Content ─────────────────────────────────────────────────────────────

  getText(): string | undefined { return this.msg.text; }
  getCaption(): string | undefined { return this.msg.caption; }
  getMentions(): string[] { return this.msg.mentions; }
  isCommand(): boolean { return this.msg.isCommand; }
  isForwarded(): boolean { return this.msg.isForwarded ?? false; }
  isViewOnce(): boolean { return this.msg.isViewOnce ?? false; }
  isEphemeral(): boolean { return this.msg.isEphemeral ?? false; }

  // ── Quoted message ──────────────────────────────────────────────────────

  hasQuoted(): boolean { return !!this.msg.quoted; }
  getQuotedId(): string | undefined { return this.msg.quoted?.id; }
  getQuotedSender(): string | undefined { return this.msg.quoted?.senderJid; }
  getQuotedText(): string | undefined { return this.msg.quoted?.text; }
  getQuotedType(): MessageType | undefined { return this.msg.quoted?.type; }

  // ── Media metadata ──────────────────────────────────────────────────────

  getMediaInfo() { return this.msg.mediaInfo; }
  getMimeType(): string | undefined { return this.msg.mediaInfo?.mimeType; }
  getFileSize(): number | undefined { return this.msg.mediaInfo?.fileLength; }
  getFileName(): string | undefined { return this.msg.mediaInfo?.fileName; }

  // ── Type-specific extras ────────────────────────────────────────────────

  getPollInfo() { return this.msg.pollInfo; }
  getReactionInfo() { return this.msg.reactionInfo; }
  getLocationInfo() { return this.msg.locationInfo; }
  getContactInfo() { return this.msg.contactInfo; }
  getLinkPreview() { return this.msg.linkPreview; }
  getNewsletterInfo() { return this.msg.newsletterInfo; }
  getInteractiveInfo() { return this.msg.interactiveInfo; }

  // ── Raw access (edge cases only) ────────────────────────────────────────

  getRaw(): unknown { return this.msg.raw; }
  getNormalized(): ExtendedNormalizedMessage { return this.msg; }
}
