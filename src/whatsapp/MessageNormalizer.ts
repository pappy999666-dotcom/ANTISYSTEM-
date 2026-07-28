/**
 * PAPPYBOT V2 — Message Normalizer
 *
 * Converts raw Baileys WAMessage objects into the platform-neutral
 * NormalizedMessage format. All internal processing uses NormalizedMessage —
 * never raw Baileys objects.
 *
 * NOTE: Only supported Baileys message structures are handled.
 * Unsupported types fall through as type='unknown'.
 */

import type { NormalizedMessage, MessageType, MessageSender, MessageQuoted } from '../types/Message';
import { normalizeJid, isGroupJid, jidToPhone } from '../utils/jid';
import { logger } from '../logger/Logger';

const log = logger.child('MessageNormalizer');

export class MessageNormalizer {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * Normalize a raw Baileys message into a NormalizedMessage.
   * Returns undefined if the message should be silently ignored (e.g. empty, protocol).
   */
  normalize(raw: unknown, sessionId: string, ownerJid: string): NormalizedMessage | undefined {
    try {
      return this.extract(raw, sessionId, ownerJid);
    } catch (err) {
      log.warn('Failed to normalize message', { sessionId, error: String(err) });
      return undefined;
    }
  }

  private extract(raw: unknown, sessionId: string, ownerJid: string): NormalizedMessage | undefined {
    const msg = raw as Record<string, unknown>;
    const key = msg['key'] as Record<string, unknown> | undefined;
    if (!key) return undefined;

    const messageId = key['id'] as string | undefined;
    const remoteJid = key['remoteJid'] as string | undefined;
    const fromMe = key['fromMe'] as boolean | undefined;

    if (!messageId || !remoteJid) return undefined;

    const chatJid = normalizeJid(remoteJid);
    const chatType = isGroupJid(chatJid) ? 'group' : 'private';

    // Resolve actual sender
    let senderJid: string;
    if (chatType === 'group') {
      senderJid = normalizeJid((key['participant'] as string) ?? ownerJid);
    } else {
      senderJid = fromMe ? normalizeJid(ownerJid) : normalizeJid(chatJid);
    }

    const message = msg['message'] as Record<string, unknown> | undefined;
    if (!message) return undefined;

    const { type, text } = this.extractContent(message);
    const quoted = this.extractQuoted(message);
    const mentions = this.extractMentions(message);
    const pushName = msg['pushName'] as string | undefined;

    const sender: MessageSender = {
      jid: senderJid,
      phone: jidToPhone(senderJid),
      displayName: pushName,
      isBot: fromMe ?? false,
    };

    const isOwner = senderJid === normalizeJid(ownerJid);
    const isCommand = !!(text?.trimStart().startsWith(this.prefix));

    return {
      id: messageId,
      sessionId,
      chatJid,
      chatType,
      sender,
      type,
      text: text ?? undefined,
      quoted: quoted ?? undefined,
      mentions,
      timestamp: (msg['messageTimestamp'] as number) ?? Math.floor(Date.now() / 1000),
      isOwner,
      isCommand,
      raw,
    };
  }

  private extractContent(message: Record<string, unknown>): { type: MessageType; text: string | null } {
    if (message['conversation']) {
      return { type: 'text', text: message['conversation'] as string };
    }
    if (message['extendedTextMessage']) {
      const ext = message['extendedTextMessage'] as Record<string, unknown>;
      return { type: 'text', text: ext['text'] as string };
    }
    if (message['imageMessage']) {
      const img = message['imageMessage'] as Record<string, unknown>;
      return { type: 'image', text: (img['caption'] as string) ?? null };
    }
    if (message['videoMessage']) {
      const vid = message['videoMessage'] as Record<string, unknown>;
      return { type: 'video', text: (vid['caption'] as string) ?? null };
    }
    if (message['audioMessage']) {
      const audio = message['audioMessage'] as Record<string, unknown>;
      const isPtt = audio['ptt'] as boolean | undefined;
      return { type: isPtt ? 'voice' : 'audio', text: null };
    }
    if (message['documentMessage']) {
      return { type: 'document', text: null };
    }
    if (message['stickerMessage']) {
      return { type: 'sticker', text: null };
    }
    if (message['locationMessage']) {
      return { type: 'location', text: null };
    }
    if (message['contactMessage'] || message['contactsArrayMessage']) {
      return { type: 'contact', text: null };
    }
    if (message['reactionMessage']) {
      return { type: 'reaction', text: null };
    }
    if (message['pollCreationMessage']) {
      return { type: 'poll', text: null };
    }
    return { type: 'unknown', text: null };
  }

  private extractQuoted(message: Record<string, unknown>): MessageQuoted | null {
    const ext = message['extendedTextMessage'] as Record<string, unknown> | undefined;
    if (!ext) return null;
    const ctx = ext['contextInfo'] as Record<string, unknown> | undefined;
    if (!ctx?.['quotedMessage']) return null;

    return {
      id: ctx['stanzaId'] as string ?? '',
      senderJid: normalizeJid(ctx['participant'] as string ?? ''),
      text: (ctx['quotedMessage'] as Record<string, unknown>)['conversation'] as string | undefined,
      type: 'text',
    };
  }

  private extractMentions(message: Record<string, unknown>): string[] {
    const ext = message['extendedTextMessage'] as Record<string, unknown> | undefined;
    const ctx = ext?.['contextInfo'] as Record<string, unknown> | undefined;
    const mentioned = ctx?.['mentionedJid'] as string[] | undefined;
    return mentioned?.map(normalizeJid) ?? [];
  }
}
