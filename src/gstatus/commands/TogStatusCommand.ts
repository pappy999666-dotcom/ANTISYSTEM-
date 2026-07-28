/**
 * PAPPYBOT V2 — .togstatus Command
 *
 * Sends Group Status content to a selected target WhatsApp group.
 * Reuses the existing GroupEngine for all group operations.
 * Reuses the existing SendMessageService for delivery.
 *
 * Usage:
 *   .togstatus <groupJid>                    — forward quoted message to group
 *   .togstatus <groupJid> <text>             — send text to group
 *   .togstatus https://chat.whatsapp.com/... — resolve invite link then send
 *
 * Target validation:
 *   - Group must exist in GroupCache
 *   - Bot must be a member
 *   - Session must own the group access
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { StatusEngine } from '../core/StatusEngine';
import type { MediaEngine } from '../../whatsapp/MediaEngine';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { EventBus } from '../../events/EventBus';
import { normalizeJid } from '../../utils/jid';
import { ROLES } from '../../types/Permissions';

const INVITE_LINK_REGEX = /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/;

export class TogStatusCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'togstatus',
    description: 'Send status content to a target WhatsApp group',
    usage: 'togstatus <groupJid|inviteLink> [text]',
    examples: [
      '.togstatus 1234567890-group@g.us Hello!',
      '.togstatus https://chat.whatsapp.com/ABC123 (reply to media)',
    ],
    category: 'owner',
    aliases: ['sendtostatus', 'tostatus'],
    requiredRole: ROLES.SESSION_OWNER,
    groupOnly: false,
    cooldown: 3_000,
  };

  constructor(
    private readonly statusEngine: StatusEngine,
    private readonly mediaEngine: MediaEngine,
    private readonly groupCache: GroupCache,
    private readonly socketManager: SocketManager,
    private readonly bus: EventBus
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const sessionId = message.sessionId;

    if (!args.argv[0]) {
      await this.replyError(ctx, 'Usage: .togstatus <groupJid|inviteLink> [text]');
      return;
    }

    // ── Resolve target group JID ──────────────────────────────────────────
    const targetJid = await this.resolveTarget(sessionId, args.argv[0]!, ctx);
    if (!targetJid) return; // error already sent

    // ── Validate target ───────────────────────────────────────────────────
    const validationError = await this.validateTarget(sessionId, targetJid);
    if (validationError) {
      await this.replyError(ctx, validationError);
      return;
    }

    // ── Build content ─────────────────────────────────────────────────────
    const caption = args.argv.slice(1).join(' ').trim() || undefined;
    const quoted = message.quotedMessage;

    try {
      await this.sendToGroup(ctx, sessionId, targetJid, quoted, caption);
    } catch (err) {
      await this.replyError(ctx, `Failed to send: ${String(err)}`);
    }
  }

  private async resolveTarget(
    sessionId: string,
    raw: string,
    ctx: CommandContext
  ): Promise<string | null> {
    // Invite link
    const inviteMatch = INVITE_LINK_REGEX.exec(raw);
    if (inviteMatch) {
      const code = inviteMatch[1]!;
      const sock = this.socketManager.getSocket(sessionId);
      if (!sock) {
        await this.replyError(ctx, 'Session not connected');
        return null;
      }
      try {
        const info = await (sock as Record<string, Function>)['groupGetInviteInfo'](code) as Record<string, unknown>;
        return normalizeJid(info['id'] as string ?? '');
      } catch {
        await this.replyError(ctx, 'Could not resolve invite link. Make sure the bot is already in the group.');
        return null;
      }
    }

    // Direct JID
    if (raw.includes('@g.us') || raw.includes('-')) {
      return normalizeJid(raw);
    }

    await this.replyError(ctx, 'Invalid target. Provide a group JID or invite link.');
    return null;
  }

  private async validateTarget(sessionId: string, groupJid: string): Promise<string | null> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return 'Session not connected';

    // Check GroupCache first
    const cached = this.groupCache.get(groupJid);
    if (cached) {
      const botJid = normalizeJid(((sock.user as Record<string, unknown>)?.['id'] as string | undefined) ?? '');
      const isMember = cached.participants.some(p => p.jid === botJid);
      if (!isMember) return 'Bot is not a member of this group';
      return null;
    }

    // Try fetching metadata
    try {
      const raw = await (sock as Record<string, Function>)['groupMetadata'](groupJid) as Record<string, unknown>;
      if (!raw) return 'Group not found';
      return null;
    } catch {
      return 'Group not found or bot is not a member';
    }
  }

  private async sendToGroup(
    ctx: CommandContext,
    sessionId: string,
    groupJid: string,
    quoted: typeof ctx.message.quotedMessage,
    caption?: string
  ): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);

    // ── Quoted media ──────────────────────────────────────────────────────
    if (quoted) {
      const mediaBuffer = quoted.mediaBuffer as Buffer | undefined;
      const type = quoted.type as string | undefined;
      const text = caption ?? (quoted.text as string | undefined) ?? '';

      if (mediaBuffer && type && type !== 'text') {
        const payload = this.buildMediaPayload(type, mediaBuffer, text, quoted as Record<string, unknown>);
        await (sock as Record<string, Function>)['sendMessage'](groupJid, payload);
        await ctx.reply(`✅ Sent to group \`${groupJid.split('@')[0]}\``);
        await this.bus.emit('status:togstatus_sent', { sessionId, groupJid, statusId: 'direct' });
        return;
      }

      // Quoted text
      const textToSend = text || ((quoted.text as string | undefined) ?? '');
      if (textToSend) {
        await (sock as Record<string, Function>)['sendMessage'](groupJid, { text: textToSend });
        await ctx.reply(`✅ Sent to group \`${groupJid.split('@')[0]}\``);
        await this.bus.emit('status:togstatus_sent', { sessionId, groupJid, statusId: 'direct' });
        return;
      }
    }

    // ── Direct text ───────────────────────────────────────────────────────
    if (caption) {
      await (sock as Record<string, Function>)['sendMessage'](groupJid, { text: caption });
      await ctx.reply(`✅ Sent to group \`${groupJid.split('@')[0]}\``);
      await this.bus.emit('status:togstatus_sent', { sessionId, groupJid, statusId: 'direct' });
      return;
    }

    await this.replyError(ctx, 'Nothing to send. Provide text or reply to a message.');
  }

  private buildMediaPayload(
    type: string,
    buf: Buffer,
    caption: string,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    switch (type) {
      case 'image':    return { image: buf, caption };
      case 'video':    return { video: buf, caption };
      case 'audio':    return { audio: buf, mimetype: source['mimeType'] as string ?? 'audio/mp4' };
      case 'voice':    return { audio: buf, mimetype: 'audio/ogg; codecs=opus', ptt: true };
      case 'sticker':  return { sticker: buf };
      case 'document': return { document: buf, fileName: source['fileName'] as string ?? 'file', mimetype: source['mimeType'] as string ?? 'application/octet-stream', caption };
      default:         return { text: caption };
    }
  }
}
