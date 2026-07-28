/**
 * PAPPYBOT V2 — Tag Engine
 *
 * Mentions every participant in a group with an optional message or media.
 * Reuses existing media/link preview metadata when available.
 * Never duplicates media — sends once with all mentions attached.
 *
 * Supported tag payloads:
 *   - Text only
 *   - Text + mentions
 *   - Image + caption + mentions
 *   - Video + caption + mentions
 *   - Audio + mentions
 *   - Voice note + mentions
 *   - Sticker + mentions
 *   - Document + mentions
 *   - Quoted message + mentions
 *   - Existing link preview metadata (reused as-is)
 */

import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { TagOptions } from '../types/Group';
import { logger } from '../../logger/Logger';

const log = logger.child('TagEngine');

export class TagEngine {
  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache
  ) {}

  /**
   * Tag all participants in a group.
   * Returns the sent message ID or undefined on failure.
   */
  async tagAll(
    sessionId: string,
    groupJid: string,
    options: TagOptions = {}
  ): Promise<string | undefined> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return undefined;

    const meta = this.groupCache.get(groupJid);
    const participants = meta?.participants.map(p => p.jid) ?? [];

    if (!participants.length) {
      log.warn('Tag: no participants in cache', { groupJid });
      return undefined;
    }

    const payload = this.buildPayload(participants, options);

    try {
      const result = await sock.sendMessage(groupJid, payload) as Record<string, unknown> | undefined;
      log.debug('Tag sent', { groupJid, count: participants.length });
      return (result?.['key'] as Record<string, unknown>)?.['id'] as string | undefined;
    } catch (err) {
      log.error('Tag failed', { groupJid, error: String(err) });
      return undefined;
    }
  }

  private buildPayload(mentions: string[], options: TagOptions): Record<string, unknown> {
    const base: Record<string, unknown> = { mentions };

    if (options.quotedKey) base['quoted'] = { key: options.quotedKey };

    const { mediaBuffer, mediaType, mimeType, fileName, message, linkPreviewMetadata } = options;

    if (mediaBuffer) {
      switch (mediaType) {
        case 'image':
          return { ...base, image: mediaBuffer, caption: message ?? '' };
        case 'video':
          return { ...base, video: mediaBuffer, caption: message ?? '' };
        case 'audio':
          return { ...base, audio: mediaBuffer, mimetype: mimeType ?? 'audio/mp4' };
        case 'voice':
          return { ...base, audio: mediaBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true };
        case 'sticker':
          return { ...base, sticker: mediaBuffer };
        case 'document':
          return { ...base, document: mediaBuffer, fileName: fileName ?? 'file', mimetype: mimeType ?? 'application/octet-stream' };
      }
    }

    // Reuse existing link preview metadata when available
    if (linkPreviewMetadata) {
      return { ...base, text: message ?? '', ...linkPreviewMetadata };
    }

    // Plain text with formatted mention list if no message provided
    const text = message ?? this.buildMentionList(mentions);
    return { ...base, text };
  }

  private buildMentionList(jids: string[]): string {
    return jids.map(j => `@${j.split('@')[0]}`).join('\n');
  }
}
