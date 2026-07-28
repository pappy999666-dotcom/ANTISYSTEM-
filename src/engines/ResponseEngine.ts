/**
 * PAPPYBOT V2 — Response Engine
 *
 * Single, unified outgoing message builder. Every module that needs to
 * send a WhatsApp message must go through this engine — never call
 * Baileys methods directly from business logic.
 *
 * Supported types: text, image, video, audio, voice, document, sticker,
 *                  quoted replies, mentions, interactive messages.
 */

import type { OutgoingMessage } from '../types/Message';
import { logger } from '../logger/Logger';

const log = logger.child('ResponseEngine');

/** Sender function injected by WhatsAppClient */
export type SendFunction = (
  sessionId: string,
  chatJid: string,
  payload: unknown
) => Promise<string>;

export class ResponseEngine {
  private sendFn?: SendFunction;

  /**
   * Inject the actual Baileys send function from WhatsAppClient.
   * Must be called during bootstrap.
   */
  setSendFunction(fn: SendFunction): void {
    this.sendFn = fn;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public sending API
  // ─────────────────────────────────────────────────────────────────────────

  async send(msg: OutgoingMessage): Promise<string> {
    this.assertReady();
    const payload = this.buildPayload(msg);
    const messageId = await this.sendFn!(msg.sessionId, msg.chatJid, payload);
    log.trace('Message sent', { sessionId: msg.sessionId, type: msg.type, chatJid: msg.chatJid });
    return messageId;
  }

  async sendText(sessionId: string, chatJid: string, text: string, quotedId?: string): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'text', text, quotedMessageId: quotedId });
  }

  /** Send text and return the message ID (for live editing). */
  async sendTextGetId(sessionId: string, chatJid: string, text: string, quotedId?: string): Promise<string | undefined> {
    try {
      return await this.sendText(sessionId, chatJid, text, quotedId);
    } catch {
      return undefined;
    }
  }

  /**
   * Edit a previously sent text message.
   * Uses Baileys sendMessage with edit key.
   * LIMITATION: WhatsApp only allows editing messages sent by the bot itself.
   */
  async editText(sessionId: string, chatJid: string, messageId: string, newText: string): Promise<void> {
    this.assertReady();
    try {
      await this.sendFn!(sessionId, chatJid, {
        text: newText,
        edit: { remoteJid: chatJid, id: messageId, fromMe: true },
      });
      log.trace('Message edited', { sessionId, chatJid, messageId });
    } catch (err) {
      // Edit not supported for this message type — fall back silently
      log.debug('Message edit failed (not supported or expired)', { messageId, error: String(err) });
    }
  }

  async sendImage(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    caption?: string,
    quotedId?: string
  ): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'image', media, caption, quotedMessageId: quotedId });
  }

  async sendVideo(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    caption?: string
  ): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'video', media, caption });
  }

  async sendAudio(sessionId: string, chatJid: string, media: Buffer | string): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'audio', media });
  }

  async sendVoice(sessionId: string, chatJid: string, media: Buffer | string): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'voice', media, mimeType: 'audio/ogg; codecs=opus' });
  }

  async sendDocument(
    sessionId: string,
    chatJid: string,
    media: Buffer | string,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'document', media, fileName, mimeType });
  }

  async sendSticker(sessionId: string, chatJid: string, media: Buffer | string): Promise<string> {
    return this.send({ sessionId, chatJid, type: 'sticker', media });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Payload builder
  // ─────────────────────────────────────────────────────────────────────────

  private buildPayload(msg: OutgoingMessage): Record<string, unknown> {
    const base: Record<string, unknown> = {};

    if (msg.mentions?.length) {
      base['mentions'] = msg.mentions;
    }

    if (msg.quotedMessageId) {
      base['quoted'] = { key: { id: msg.quotedMessageId } };
    }

    switch (msg.type) {
      case 'text':
        return { ...base, text: msg.text ?? '' };

      case 'image':
        return {
          ...base,
          image: this.resolveMedia(msg.media!),
          caption: msg.caption,
        };

      case 'video':
        return {
          ...base,
          video: this.resolveMedia(msg.media!),
          caption: msg.caption,
        };

      case 'audio':
        return {
          ...base,
          audio: this.resolveMedia(msg.media!),
          mimetype: msg.mimeType ?? 'audio/mp4',
        };

      case 'voice':
        return {
          ...base,
          audio: this.resolveMedia(msg.media!),
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true,
        };

      case 'document':
        return {
          ...base,
          document: this.resolveMedia(msg.media!),
          fileName: msg.fileName,
          mimetype: msg.mimeType,
        };

      case 'sticker':
        return {
          ...base,
          sticker: this.resolveMedia(msg.media!),
        };

      default:
        throw new Error(`ResponseEngine: unsupported message type "${msg.type as string}"`);
    }
  }

  private resolveMedia(media: Buffer | string): { url: string } | Buffer {
    if (typeof media === 'string') {
      return { url: media };
    }
    return media;
  }

  private assertReady(): void {
    if (!this.sendFn) {
      throw new Error('ResponseEngine: sendFn not set. Did you call setSendFunction()?');
    }
  }
}
