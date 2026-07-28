/**
 * PAPPYBOT V2 — Message Normalizer
 *
 * Converts raw Baileys WAMessage objects into the platform-neutral
 * NormalizedMessage format. All internal processing uses NormalizedMessage —
 * never raw Baileys objects.
 *
 * Supported types:
 *   text, image, video, audio, voice, sticker, document, contact, location,
 *   poll, reaction, forwarded, view-once, ephemeral, interactive/buttons,
 *   newsletter/channel, quoted, mentions, captions, link preview metadata.
 *
 * NOTE: Only supported Baileys message structures are handled.
 * Unsupported / future types fall through as type='unknown'.
 */

import type {
  NormalizedMessage,
  MessageType,
  MessageSender,
  MessageQuoted,
} from '../types/Message';
import { normalizeJid, isGroupJid, jidToPhone } from '../utils/jid';
import { logger } from '../logger/Logger';

const log = logger.child('MessageNormalizer');

// ── Extended NormalizedMessage fields ──────────────────────────────────────

export interface ExtendedNormalizedMessage extends NormalizedMessage {
  /** Captions extracted from media messages */
  caption?: string;
  /** Whether message is view-once */
  isViewOnce?: boolean;
  /** Whether message is ephemeral (disappearing) */
  isEphemeral?: boolean;
  /** Ephemeral expiration seconds */
  ephemeralExpiration?: number;
  /** Forwarding score — 0 means not forwarded */
  forwardingScore?: number;
  /** Whether this was forwarded */
  isForwarded?: boolean;
  /** Poll info if type === 'poll' */
  pollInfo?: {
    name: string;
    options: string[];
    selectableCount: number;
  };
  /** Reaction info if type === 'reaction' */
  reactionInfo?: {
    targetMessageId: string;
    emoji: string;
  };
  /** Location data if type === 'location' */
  locationInfo?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
    isLive?: boolean;
  };
  /** Contact cards if type === 'contact' */
  contactInfo?: Array<{ displayName?: string; vcard: string }>;
  /** Media metadata (dimensions, duration, file size) */
  mediaInfo?: {
    mimeType?: string;
    fileSha256?: string;
    fileLength?: number;
    width?: number;
    height?: number;
    seconds?: number;
    fileName?: string;
  };
  /** Link preview metadata if present */
  linkPreview?: {
    url?: string;
    title?: string;
    description?: string;
    thumbnailUrl?: string;
  };
  /** Newsletter / channel metadata if available */
  newsletterInfo?: {
    newsletterJid?: string;
    newsletterName?: string;
  };
  /** Buttons / interactive message info */
  interactiveInfo?: {
    type: string;
    title?: string;
    body?: string;
    footer?: string;
    selectedButtonId?: string;
    selectedRowId?: string;
  };
}

export class MessageNormalizer {
  private readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  /**
   * Normalize a raw Baileys message into an ExtendedNormalizedMessage.
   * Returns undefined if the message should be silently ignored (empty, protocol, etc.).
   */
  normalize(
    raw: unknown,
    sessionId: string,
    ownerJid: string
  ): ExtendedNormalizedMessage | undefined {
    try {
      return this.extract(raw, sessionId, ownerJid);
    } catch (err) {
      log.warn('Failed to normalize message', { sessionId, error: String(err) });
      return undefined;
    }
  }

  // ── Private extraction ──────────────────────────────────────────────────

  private extract(
    raw: unknown,
    sessionId: string,
    ownerJid: string
  ): ExtendedNormalizedMessage | undefined {
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

    // Unwrap ephemeral / view-once wrappers before extracting content
    let message = msg['message'] as Record<string, unknown> | undefined;
    if (!message) return undefined;

    let isEphemeral = false;
    let ephemeralExpiration: number | undefined;
    let isViewOnce = false;

    // Unwrap ephemeral wrapper
    if (message['ephemeralMessage']) {
      isEphemeral = true;
      const ephemeral = message['ephemeralMessage'] as Record<string, unknown>;
      ephemeralExpiration =
        (msg['messageContextInfo'] as Record<string, unknown> | undefined)?.['ephemeralExpiration'] as number | undefined
        ?? (ephemeral['message'] as Record<string, unknown> | undefined)?.['ephemeralExpiration'] as number | undefined;
      message = (ephemeral['message'] as Record<string, unknown> | undefined) ?? message;
    }

    // Unwrap view-once wrapper
    if (message['viewOnceMessage'] || message['viewOnceMessageV2']) {
      isViewOnce = true;
      const voWrapper = (message['viewOnceMessage'] ?? message['viewOnceMessageV2']) as Record<string, unknown>;
      const inner = voWrapper['message'] as Record<string, unknown> | undefined;
      if (inner) message = inner;
    }

    // Extract content
    const { type, text, extra } = this.extractContent(message);

    // Skip pure protocol messages
    if (type === 'unknown' && !text) {
      const keys = Object.keys(message);
      if (
        keys.includes('protocolMessage') ||
        keys.includes('senderKeyDistributionMessage') ||
        keys.includes('messageContextInfo')
      ) {
        return undefined;
      }
    }

    const quoted = this.extractQuoted(message);
    const mentions = this.extractMentions(message);
    const linkPreview = this.extractLinkPreview(message);
    const pushName = msg['pushName'] as string | undefined;

    // Forwarding info
    const ctxInfo = this.getContextInfo(message);
    const forwardingScore = (ctxInfo?.['forwardingScore'] as number | undefined) ?? 0;
    const isForwarded = forwardingScore > 0;

    // Newsletter / channel
    const newsletterInfo = this.extractNewsletterInfo(msg, key);

    const sender: MessageSender = {
      jid: senderJid,
      phone: jidToPhone(senderJid),
      displayName: pushName,
      isBot: fromMe ?? false,
    };

    const isOwner = senderJid === normalizeJid(ownerJid);
    const textContent = text ?? extra?.['caption'] as string | undefined ?? null;
    const isCommand = !!(textContent?.trimStart().startsWith(this.prefix));

    const result: ExtendedNormalizedMessage = {
      id: messageId,
      sessionId,
      chatJid,
      chatType,
      sender,
      type,
      text: textContent ?? undefined,
      caption: extra?.['caption'] as string | undefined,
      quoted: quoted ?? undefined,
      mentions,
      timestamp: (msg['messageTimestamp'] as number) ?? Math.floor(Date.now() / 1000),
      isOwner,
      isCommand,
      isViewOnce,
      isEphemeral,
      ephemeralExpiration,
      forwardingScore,
      isForwarded,
      raw,
      linkPreview: linkPreview ?? undefined,
      newsletterInfo: newsletterInfo ?? undefined,
    };

    // Attach type-specific extras
    if (extra?.['pollInfo']) result.pollInfo = extra['pollInfo'] as ExtendedNormalizedMessage['pollInfo'];
    if (extra?.['reactionInfo']) result.reactionInfo = extra['reactionInfo'] as ExtendedNormalizedMessage['reactionInfo'];
    if (extra?.['locationInfo']) result.locationInfo = extra['locationInfo'] as ExtendedNormalizedMessage['locationInfo'];
    if (extra?.['contactInfo']) result.contactInfo = extra['contactInfo'] as ExtendedNormalizedMessage['contactInfo'];
    if (extra?.['mediaInfo']) result.mediaInfo = extra['mediaInfo'] as ExtendedNormalizedMessage['mediaInfo'];
    if (extra?.['interactiveInfo']) result.interactiveInfo = extra['interactiveInfo'] as ExtendedNormalizedMessage['interactiveInfo'];

    return result;
  }

  // ── Content extraction ──────────────────────────────────────────────────

  private extractContent(
    message: Record<string, unknown>
  ): { type: MessageType; text: string | null; extra?: Record<string, unknown> } {
    // ── Plain text ──
    if (message['conversation']) {
      return { type: 'text', text: message['conversation'] as string };
    }

    // ── Extended text / link preview ──
    if (message['extendedTextMessage']) {
      const ext = message['extendedTextMessage'] as Record<string, unknown>;
      return { type: 'text', text: ext['text'] as string };
    }

    // ── Image ──
    if (message['imageMessage']) {
      const img = message['imageMessage'] as Record<string, unknown>;
      return {
        type: 'image',
        text: null,
        extra: {
          caption: (img['caption'] as string) ?? null,
          mediaInfo: this.extractMediaMeta(img),
        },
      };
    }

    // ── Video (including GIF) ──
    if (message['videoMessage']) {
      const vid = message['videoMessage'] as Record<string, unknown>;
      return {
        type: 'video',
        text: null,
        extra: {
          caption: (vid['caption'] as string) ?? null,
          mediaInfo: this.extractMediaMeta(vid),
        },
      };
    }

    // ── Audio / Voice note ──
    if (message['audioMessage']) {
      const audio = message['audioMessage'] as Record<string, unknown>;
      const isPtt = audio['ptt'] as boolean | undefined;
      return {
        type: isPtt ? 'voice' : 'audio',
        text: null,
        extra: { mediaInfo: this.extractMediaMeta(audio) },
      };
    }

    // ── Document ──
    if (message['documentMessage']) {
      const doc = message['documentMessage'] as Record<string, unknown>;
      return {
        type: 'document',
        text: null,
        extra: {
          caption: (doc['caption'] as string) ?? null,
          mediaInfo: {
            ...this.extractMediaMeta(doc),
            fileName: doc['fileName'] as string | undefined,
          },
        },
      };
    }

    // ── Sticker ──
    if (message['stickerMessage']) {
      const sticker = message['stickerMessage'] as Record<string, unknown>;
      return {
        type: 'sticker',
        text: null,
        extra: { mediaInfo: this.extractMediaMeta(sticker) },
      };
    }

    // ── Location ──
    if (message['locationMessage'] || message['liveLocationMessage']) {
      const loc = (message['locationMessage'] ?? message['liveLocationMessage']) as Record<string, unknown>;
      return {
        type: 'location',
        text: null,
        extra: {
          locationInfo: {
            latitude: loc['degreesLatitude'] as number,
            longitude: loc['degreesLongitude'] as number,
            name: loc['name'] as string | undefined,
            address: loc['address'] as string | undefined,
            isLive: !!message['liveLocationMessage'],
          },
        },
      };
    }

    // ── Contact(s) ──
    if (message['contactMessage']) {
      const c = message['contactMessage'] as Record<string, unknown>;
      return {
        type: 'contact',
        text: null,
        extra: {
          contactInfo: [
            { displayName: c['displayName'] as string | undefined, vcard: c['vcard'] as string ?? '' },
          ],
        },
      };
    }
    if (message['contactsArrayMessage']) {
      const ca = message['contactsArrayMessage'] as Record<string, unknown>;
      const contacts = (ca['contacts'] as Array<Record<string, unknown>>) ?? [];
      return {
        type: 'contact',
        text: null,
        extra: {
          contactInfo: contacts.map(c => ({
            displayName: c['displayName'] as string | undefined,
            vcard: c['vcard'] as string ?? '',
          })),
        },
      };
    }

    // ── Reaction ──
    if (message['reactionMessage']) {
      const r = message['reactionMessage'] as Record<string, unknown>;
      const rKey = r['key'] as Record<string, unknown> | undefined;
      return {
        type: 'reaction',
        text: null,
        extra: {
          reactionInfo: {
            targetMessageId: rKey?.['id'] as string ?? '',
            emoji: r['text'] as string ?? '',
          },
        },
      };
    }

    // ── Poll creation ──
    if (message['pollCreationMessage'] || message['pollCreationMessageV2'] || message['pollCreationMessageV3']) {
      const poll = (
        message['pollCreationMessage'] ??
        message['pollCreationMessageV2'] ??
        message['pollCreationMessageV3']
      ) as Record<string, unknown>;
      const options = (poll['options'] as Array<Record<string, unknown>>) ?? [];
      return {
        type: 'poll',
        text: null,
        extra: {
          pollInfo: {
            name: poll['name'] as string ?? '',
            options: options.map(o => o['optionName'] as string ?? ''),
            selectableCount: (poll['selectableOptionsCount'] as number) ?? 1,
          },
        },
      };
    }

    // ── Poll update (vote) — surface as 'poll' type ──
    if (message['pollUpdateMessage']) {
      return { type: 'poll', text: null };
    }

    // ── Interactive / button reply messages ──
    if (message['buttonsResponseMessage']) {
      const br = message['buttonsResponseMessage'] as Record<string, unknown>;
      return {
        type: 'text',
        text: br['selectedDisplayText'] as string ?? null,
        extra: {
          interactiveInfo: {
            type: 'buttonsResponse',
            selectedButtonId: br['selectedButtonId'] as string | undefined,
          },
        },
      };
    }

    if (message['listResponseMessage']) {
      const lr = message['listResponseMessage'] as Record<string, unknown>;
      const row = lr['singleSelectReply'] as Record<string, unknown> | undefined;
      return {
        type: 'text',
        text: lr['title'] as string ?? null,
        extra: {
          interactiveInfo: {
            type: 'listResponse',
            selectedRowId: row?.['selectedRowId'] as string | undefined,
          },
        },
      };
    }

    if (message['interactiveResponseMessage']) {
      const ir = message['interactiveResponseMessage'] as Record<string, unknown>;
      return {
        type: 'text',
        text: (ir['body'] as Record<string, unknown> | undefined)?.['text'] as string ?? null,
        extra: {
          interactiveInfo: {
            type: 'interactiveResponse',
            body: (ir['body'] as Record<string, unknown> | undefined)?.['text'] as string | undefined,
          },
        },
      };
    }

    return { type: 'unknown', text: null };
  }

  // ── Quoted message extraction ───────────────────────────────────────────

  private extractQuoted(message: Record<string, unknown>): MessageQuoted | null {
    const ctx = this.getContextInfo(message);
    if (!ctx?.['quotedMessage']) return null;

    const quotedMsg = ctx['quotedMessage'] as Record<string, unknown>;
    const quotedType = this.detectQuotedType(quotedMsg);

    const quotedText =
      (quotedMsg['conversation'] as string | undefined) ??
      (quotedMsg['extendedTextMessage'] as Record<string, unknown> | undefined)?.['text'] as string | undefined ??
      (quotedMsg['imageMessage'] as Record<string, unknown> | undefined)?.['caption'] as string | undefined ??
      (quotedMsg['videoMessage'] as Record<string, unknown> | undefined)?.['caption'] as string | undefined;

    return {
      id: ctx['stanzaId'] as string ?? '',
      senderJid: normalizeJid(ctx['participant'] as string ?? ''),
      text: quotedText,
      type: quotedType,
    };
  }

  private detectQuotedType(quotedMsg: Record<string, unknown>): MessageType {
    if (quotedMsg['conversation'] || quotedMsg['extendedTextMessage']) return 'text';
    if (quotedMsg['imageMessage']) return 'image';
    if (quotedMsg['videoMessage']) return 'video';
    if (quotedMsg['audioMessage']) {
      const audio = quotedMsg['audioMessage'] as Record<string, unknown>;
      return audio['ptt'] ? 'voice' : 'audio';
    }
    if (quotedMsg['documentMessage']) return 'document';
    if (quotedMsg['stickerMessage']) return 'sticker';
    if (quotedMsg['locationMessage']) return 'location';
    if (quotedMsg['contactMessage']) return 'contact';
    if (quotedMsg['pollCreationMessage']) return 'poll';
    if (quotedMsg['reactionMessage']) return 'reaction';
    return 'unknown';
  }

  // ── Mentions extraction ────────────────────────────────────────────────

  private extractMentions(message: Record<string, unknown>): string[] {
    const ctx = this.getContextInfo(message);
    const mentioned = ctx?.['mentionedJid'] as string[] | undefined;
    return mentioned?.map(normalizeJid) ?? [];
  }

  // ── Link preview extraction ────────────────────────────────────────────

  private extractLinkPreview(
    message: Record<string, unknown>
  ): ExtendedNormalizedMessage['linkPreview'] | null {
    const ext = message['extendedTextMessage'] as Record<string, unknown> | undefined;
    if (!ext) return null;
    if (!ext['canonicalUrl'] && !ext['matchedText']) return null;

    return {
      url: (ext['canonicalUrl'] ?? ext['matchedText']) as string | undefined,
      title: ext['title'] as string | undefined,
      description: ext['description'] as string | undefined,
      thumbnailUrl: undefined, // binary thumbnail not surfaced as URL
    };
  }

  // ── Newsletter / channel info ──────────────────────────────────────────

  private extractNewsletterInfo(
    msg: Record<string, unknown>,
    key: Record<string, unknown>
  ): ExtendedNormalizedMessage['newsletterInfo'] | null {
    // Baileys surfaces newsletter messages with remoteJid ending in @newsletter
    const remoteJid = key['remoteJid'] as string | undefined;
    if (!remoteJid?.endsWith('@newsletter')) return null;

    return {
      newsletterJid: remoteJid,
      newsletterName: (msg['newsletterName'] as string | undefined),
    };
  }

  // ── Media metadata extraction ──────────────────────────────────────────

  private extractMediaMeta(
    obj: Record<string, unknown>
  ): ExtendedNormalizedMessage['mediaInfo'] {
    return {
      mimeType: obj['mimetype'] as string | undefined,
      fileLength: obj['fileLength'] as number | undefined,
      width: obj['width'] as number | undefined,
      height: obj['height'] as number | undefined,
      seconds: obj['seconds'] as number | undefined,
      fileName: obj['fileName'] as string | undefined,
    };
  }

  // ── Context info helper ────────────────────────────────────────────────

  private getContextInfo(
    message: Record<string, unknown>
  ): Record<string, unknown> | undefined {
    // contextInfo can appear on various message wrappers
    for (const key of Object.keys(message)) {
      const sub = message[key] as Record<string, unknown> | undefined;
      if (sub && typeof sub === 'object' && sub['contextInfo']) {
        return sub['contextInfo'] as Record<string, unknown>;
      }
    }
    return undefined;
  }
}
