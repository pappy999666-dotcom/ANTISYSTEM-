/**
 * PAPPYBOT V2 — Send Message Service
 *
 * Unified outgoing message engine. Every part of the project that needs to
 * send a WhatsApp message calls this service — never the Baileys socket directly.
 *
 * Supports:
 *   text, image, video, audio, voice, sticker, GIF/video-as-GIF,
 *   document, contact card(s), location, polls, mentions, quoted replies,
 *   buttons/interactive (where supported by the library), captions,
 *   link previews, view-once messages.
 *
 * Extension points:
 *   - Future prompts can add new payload types without touching the socket.
 *   - ResponseEngine delegates to this service via the injected sendFn.
 */

import type { SocketManager } from './SocketManager';
import type { EventBus } from '../events/EventBus';
import { logger } from '../logger/Logger';

const log = logger.child('SendMessageService');

// ── Public option types ───────────────────────────────────────────────────

export interface QuoteOptions {
  /** Message key to quote. Provide either full key object or just the message ID. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quotedKey?: any;
  quotedMessageId?: string;
  quotedChatJid?: string;
}

export interface SendTextOptions extends QuoteOptions {
  mentions?: string[];
  linkPreview?: boolean;
}

export interface SendMediaOptions extends QuoteOptions {
  caption?: string;
  mentions?: string[];
  viewOnce?: boolean;
  fileName?: string;
  mimeType?: string;
  /** Send video as a GIF (no audio, looped). */
  gifPlayback?: boolean;
  /** Send as PTT voice note (for audio). */
  ptt?: boolean;
}

export interface PollOption {
  name: string;
}

export interface SendPollOptions {
  selectableCount?: number;
}

export interface SendLocationOptions extends QuoteOptions {
  name?: string;
  address?: string;
}

export interface SendContactOptions extends QuoteOptions {
  displayName?: string;
}

export interface SendButtonsOptions {
  footer?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headerContent?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buttons?: any[];
}

export interface SendListOptions {
  footer?: string;
  buttonText?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sections?: any[];
}

// ── Service ───────────────────────────────────────────────────────────────

export class SendMessageService {
  private readonly socketManager: SocketManager;
  private readonly bus: EventBus;

  constructor(socketManager: SocketManager, bus: EventBus) {
    this.socketManager = socketManager;
    this.bus = bus;
  }

  // ── Text ──────────────────────────────────────────────────────────────

  async sendText(
    sessionId: string,
    chatJid: string,
    text: string,
    options: SendTextOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = { text };

    if (options.mentions?.length) {
      payload['mentions'] = options.mentions;
    }

    // Link preview: omit linkPreview key = auto; set to false to disable
    if (options.linkPreview === false) {
      payload['linkPreview'] = false;
    }

    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Image ─────────────────────────────────────────────────────────────

  async sendImage(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    options: SendMediaOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      image: this._resolveMedia(media),
    };
    if (options.caption) payload['caption'] = options.caption;
    if (options.mentions?.length) payload['mentions'] = options.mentions;
    if (options.viewOnce) payload['viewOnce'] = true;

    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Video / GIF ───────────────────────────────────────────────────────

  async sendVideo(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    options: SendMediaOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      video: this._resolveMedia(media),
    };
    if (options.caption) payload['caption'] = options.caption;
    if (options.mentions?.length) payload['mentions'] = options.mentions;
    if (options.gifPlayback) payload['gifPlayback'] = true;
    if (options.viewOnce) payload['viewOnce'] = true;

    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Audio ─────────────────────────────────────────────────────────────

  async sendAudio(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    options: SendMediaOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      audio: this._resolveMedia(media),
      mimetype: options.mimeType ?? 'audio/mp4',
    };
    if (options.ptt) {
      payload['ptt'] = true;
      payload['mimetype'] = 'audio/ogg; codecs=opus';
    }

    return this._send(sessionId, chatJid, payload, options);
  }

  /** Alias for sendAudio with ptt=true (voice note). */
  async sendVoiceNote(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    options: Omit<SendMediaOptions, 'ptt'> = {}
  ): Promise<string> {
    return this.sendAudio(sessionId, chatJid, media, { ...options, ptt: true });
  }

  // ── Sticker ───────────────────────────────────────────────────────────

  async sendSticker(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    options: QuoteOptions = {}
  ): Promise<string> {
    return this._send(sessionId, chatJid, { sticker: this._resolveMedia(media) }, options);
  }

  // ── Document ──────────────────────────────────────────────────────────

  async sendDocument(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    fileName: string,
    mimeType: string,
    options: SendMediaOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      document: this._resolveMedia(media),
      fileName,
      mimetype: mimeType,
    };
    if (options.caption) payload['caption'] = options.caption;

    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Contact card ──────────────────────────────────────────────────────

  async sendContact(
    sessionId: string,
    chatJid: string,
    vcard: string,
    options: SendContactOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      contacts: {
        displayName: options.displayName ?? '',
        contacts: [{ vcard }],
      },
    };
    return this._send(sessionId, chatJid, payload, options);
  }

  /** Send multiple contact cards at once. */
  async sendContacts(
    sessionId: string,
    chatJid: string,
    contacts: Array<{ displayName?: string; vcard: string }>,
    options: QuoteOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      contacts: {
        displayName: `${contacts.length} contacts`,
        contacts: contacts.map(c => ({ vcard: c.vcard })),
      },
    };
    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Location ──────────────────────────────────────────────────────────

  async sendLocation(
    sessionId: string,
    chatJid: string,
    latitude: number,
    longitude: number,
    options: SendLocationOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      location: { degreesLatitude: latitude, degreesLongitude: longitude },
    };
    if (options.name) (payload['location'] as Record<string, unknown>)['name'] = options.name;
    if (options.address) (payload['location'] as Record<string, unknown>)['address'] = options.address;

    return this._send(sessionId, chatJid, payload, options);
  }

  // ── Poll ──────────────────────────────────────────────────────────────

  async sendPoll(
    sessionId: string,
    chatJid: string,
    question: string,
    options: PollOption[],
    pollOptions: SendPollOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      poll: {
        name: question,
        values: options.map(o => o.name),
        selectableCount: pollOptions.selectableCount ?? 1,
      },
    };
    return this._send(sessionId, chatJid, payload, {});
  }

  // ── Buttons (interactive) ─────────────────────────────────────────────

  /**
   * Send a button message.
   * Availability depends on the library version and WhatsApp server policy.
   */
  async sendButtons(
    sessionId: string,
    chatJid: string,
    bodyText: string,
    options: SendButtonsOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      text: bodyText,
      footer: options.footer,
      buttons: options.buttons ?? [],
      headerType: 1,
    };
    return this._send(sessionId, chatJid, payload, {});
  }

  /**
   * Send a list message.
   * Availability depends on the library version and WhatsApp server policy.
   */
  async sendList(
    sessionId: string,
    chatJid: string,
    bodyText: string,
    options: SendListOptions = {}
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      text: bodyText,
      footer: options.footer ?? '',
      title: '',
      buttonText: options.buttonText ?? 'Options',
      sections: options.sections ?? [],
    };
    return this._send(sessionId, chatJid, payload, {});
  }

  // ── Reactions ─────────────────────────────────────────────────────────

  /** React to a message with an emoji. Pass empty string to remove a reaction. */
  async sendReaction(
    sessionId: string,
    chatJid: string,
    messageKey: Record<string, unknown>,
    emoji: string
  ): Promise<string> {
    const payload = { react: { text: emoji, key: messageKey } };
    return this._send(sessionId, chatJid, payload, {});
  }

  // ── Read receipts ─────────────────────────────────────────────────────

  /** Mark messages as read. */
  async markRead(
    sessionId: string,
    chatJid: string,
    messageKeys: Array<Record<string, unknown>>
  ): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.readMessages(messageKeys);
    } catch (err) {
      log.warn('markRead failed', { sessionId, chatJid, error: String(err) });
    }
  }

  // ── Presence ──────────────────────────────────────────────────────────

  /** Send a presence update (typing, recording, paused). */
  async sendPresence(
    sessionId: string,
    chatJid: string,
    presence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'
  ): Promise<void> {
    const sock = this.socketManager.requireSocket(sessionId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await sock.sendPresenceUpdate(presence, chatJid);
    } catch (err) {
      log.warn('sendPresence failed', { sessionId, chatJid, presence, error: String(err) });
    }
  }

  // ── Internal ──────────────────────────────────────────────────────────

  private async _send(
    sessionId: string,
    chatJid: string,
    payload: Record<string, unknown>,
    quoteOptions: QuoteOptions
  ): Promise<string> {
    const sock = this.socketManager.requireSocket(sessionId);

    // Attach quoted message context
    if (quoteOptions.quotedKey) {
      payload['quoted'] = quoteOptions.quotedKey;
    } else if (quoteOptions.quotedMessageId) {
      payload['quoted'] = {
        key: {
          id: quoteOptions.quotedMessageId,
          remoteJid: quoteOptions.quotedChatJid ?? chatJid,
        },
      };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await sock.sendMessage(chatJid, payload) as Record<string, unknown> | undefined;
      const messageId = (result?.['key'] as Record<string, unknown>)?.['id'] as string ?? '';

      this.socketManager.touchActivity(sessionId);

      await this.bus.emit('message:sent', { messageId, sessionId, chatJid });

      log.trace('Message sent', { sessionId, chatJid, messageId });
      return messageId;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Failed to send message', { sessionId, chatJid, error: error.message });
      throw error;
    }
  }

  private _resolveMedia(media: Buffer | string): { url: string } | Buffer {
    return typeof media === 'string' ? { url: media } : media;
  }
}
