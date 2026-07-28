/**
 * PAPPYBOT V2 — .gstatus Command
 *
 * Sends content to WhatsApp Status (status@broadcast).
 *
 * Usage:
 *   .gstatus <text>                  — text status
 *   .gstatus                         — reply to a message to post it as status
 *   .gstatus <caption>               — reply to media with caption
 *
 * Supported quoted content:
 *   - Text (with optional link preview reuse)
 *   - Image + caption
 *   - Video + caption
 *   - Audio / Voice note
 *   - Sticker
 *   - Document
 *   - GIF (video with gifPlayback)
 *   - Existing hydrated link preview (reused as-is)
 *
 * All media is downloaded via MediaEngine before queuing.
 * All sends go through StatusEngine → StatusQueue.
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { StatusEngine } from '../core/StatusEngine';
import type { MediaEngine } from '../../whatsapp/MediaEngine';
import type { StatusContentType } from '../types/GStatus';
import { ROLES } from '../../types/Permissions';

export class GStatusCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'gstatus',
    description: 'Post content to WhatsApp Status (Stories)',
    usage: 'gstatus [text] | reply to media',
    examples: [
      '.gstatus Hello world!',
      '.gstatus (reply to image)',
      '.gstatus My caption (reply to video)',
    ],
    category: 'owner',
    aliases: ['status', 'poststatus'],
    requiredRole: ROLES.SESSION_OWNER,
    cooldown: 5_000,
  };

  constructor(
    private readonly statusEngine: StatusEngine,
    private readonly mediaEngine: MediaEngine
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const sessionId = message.sessionId;
    const caption = args.raw.trim() || undefined;

    // ── Quoted message handling ───────────────────────────────────────────
    const quoted = message.quotedMessage;

    if (quoted) {
      await this.handleQuoted(ctx, sessionId, quoted, caption);
      return;
    }

    // ── Direct media on the message itself ────────────────────────────────
    if (message.type !== 'text' && message.mediaBuffer) {
      await this.handleDirectMedia(ctx, sessionId, message, caption);
      return;
    }

    // ── Plain text status ─────────────────────────────────────────────────
    if (!caption) {
      await this.replyError(ctx, 'Usage: .gstatus <text> or reply to a message');
      return;
    }

    const item = this.statusEngine.enqueue(sessionId, 'text', {
      text: caption,
      generatePreview: true,
    });

    await ctx.reply(`⏳ Status queued — ID: \`${item.id}\``);
  }

  private async handleQuoted(
    ctx: CommandContext,
    sessionId: string,
    quoted: NonNullable<typeof ctx.message.quotedMessage>,
    caption?: string
  ): Promise<void> {
    const quotedType = quoted.type as string | undefined;

    // ── Reuse existing hydrated link preview ──────────────────────────────
    const existingPreview = this.extractLinkPreview(quoted);
    if (existingPreview) {
      const text = (quoted.text as string | undefined) ?? caption ?? '';
      const item = this.statusEngine.enqueue(sessionId, 'text', {
        text,
        existingPreview,
        generatePreview: false,
      });
      await ctx.reply(`⏳ Status queued (preview reused) — ID: \`${item.id}\``);
      return;
    }

    // ── Quoted text ───────────────────────────────────────────────────────
    if (!quotedType || quotedType === 'text') {
      const text = (quoted.text as string | undefined) ?? caption ?? '';
      if (!text) { await this.replyError(ctx, 'Quoted message has no text'); return; }
      const item = this.statusEngine.enqueue(sessionId, 'text', {
        text,
        generatePreview: true,
      });
      await ctx.reply(`⏳ Status queued — ID: \`${item.id}\``);
      return;
    }

    // ── Quoted media — download then queue ────────────────────────────────
    const mediaBuffer = quoted.mediaBuffer as Buffer | undefined;
    if (!mediaBuffer) {
      // Try downloading from raw message
      const rawMsg = quoted as unknown as Record<string, unknown>;
      if (!rawMsg['message']) {
        await this.replyError(ctx, 'Could not access quoted media. Try forwarding the message first.');
        return;
      }
      try {
        const buf = await this.mediaEngine.downloadMedia(sessionId, rawMsg);
        await this.queueMediaStatus(ctx, sessionId, quotedType, buf, quoted, caption);
      } catch (err) {
        await this.replyError(ctx, `Failed to download media: ${String(err)}`);
      }
      return;
    }

    await this.queueMediaStatus(ctx, sessionId, quotedType, mediaBuffer, quoted, caption);
  }

  private async handleDirectMedia(
    ctx: CommandContext,
    sessionId: string,
    message: typeof ctx.message,
    caption?: string
  ): Promise<void> {
    const buf = message.mediaBuffer as Buffer;
    const type = message.type as string;
    await this.queueMediaStatus(ctx, sessionId, type, buf, message as unknown as Record<string, unknown>, caption);
  }

  private async queueMediaStatus(
    ctx: CommandContext,
    sessionId: string,
    type: string,
    buf: Buffer,
    source: Record<string, unknown>,
    caption?: string
  ): Promise<void> {
    const contentType = this.resolveContentType(type, source);
    const mimeType = (source['mimeType'] as string | undefined) ?? undefined;
    const fileName = (source['fileName'] as string | undefined) ?? undefined;
    const text = caption ?? (source['text'] as string | undefined) ?? undefined;

    const item = this.statusEngine.enqueue(sessionId, contentType, {
      mediaBuffer: buf,
      text,
      mimeType,
      fileName,
    });

    await ctx.reply(`⏳ Status queued (${contentType}) — ID: \`${item.id}\``);
  }

  private resolveContentType(type: string, source: Record<string, unknown>): StatusContentType {
    switch (type) {
      case 'image':    return 'image';
      case 'video': {
        const isGif = (source['gifPlayback'] as boolean | undefined) ?? false;
        return isGif ? 'gif' : 'video';
      }
      case 'audio':    return 'audio';
      case 'voice':    return 'audio';
      case 'sticker':  return 'sticker';
      case 'document': return 'document';
      default:         return 'text';
    }
  }

  private extractLinkPreview(quoted: Record<string, unknown>): Record<string, unknown> | undefined {
    // Check for hydrated link preview fields from Baileys
    const hasPreview = quoted['canonicalUrl'] || quoted['matchedText'] ||
      quoted['jpegThumbnail'] || quoted['previewType'];
    if (!hasPreview) return undefined;

    const preview: Record<string, unknown> = {};
    for (const key of ['canonicalUrl', 'matchedText', 'title', 'description', 'jpegThumbnail', 'previewType']) {
      if (quoted[key] !== undefined) preview[key] = quoted[key];
    }
    return Object.keys(preview).length > 0 ? preview : undefined;
  }
}
