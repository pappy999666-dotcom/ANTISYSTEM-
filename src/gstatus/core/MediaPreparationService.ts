/**
 * PAPPYBOT V2 — Media Preparation Service
 *
 * Builds the Baileys sendMessage payload for each status content type.
 * Handles:
 *   - Text with optional background color and font
 *   - Image/Video/Audio/Sticker/Document/GIF with captions
 *   - Link preview: MODE 1 (reuse existing) and MODE 2 (generate via Baileys)
 *   - Fallback: send text without preview if generation fails
 *
 * All media goes through the existing MediaEngine for validation.
 * Never calls the socket directly.
 */

import type { StatusQueueItem } from '../types/GStatus';
import type { MediaEngine } from '../../whatsapp/MediaEngine';
import { logger } from '../../logger/Logger';

const log = logger.child('MediaPreparationService');

// URL detection regex
const URL_REGEX = /https?:\/\/[^\s]+/i;

export class MediaPreparationService {
  constructor(private readonly mediaEngine: MediaEngine) {}

  /**
   * Build the Baileys payload for a status queue item.
   * Returns the payload object ready to pass to sock.sendMessage(STATUS_JID, payload).
   */
  async buildPayload(
    item: StatusQueueItem,
    sock: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    switch (item.contentType) {
      case 'text':    return this.buildTextPayload(item, sock);
      case 'image':   return this.buildImagePayload(item);
      case 'video':   return this.buildVideoPayload(item);
      case 'audio':   return this.buildAudioPayload(item);
      case 'sticker': return this.buildStickerPayload(item);
      case 'document':return this.buildDocumentPayload(item);
      case 'gif':     return this.buildGifPayload(item);
      default:
        throw new Error(`Unsupported status content type: ${item.contentType as string}`);
    }
  }

  // ── Text ──────────────────────────────────────────────────────────────────

  private async buildTextPayload(
    item: StatusQueueItem,
    sock: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const text = item.text ?? '';
    const base: Record<string, unknown> = { text };

    if (item.mentions?.length) base['mentions'] = item.mentions;
    if (item.backgroundColor) base['backgroundColor'] = item.backgroundColor;
    if (item.font !== undefined) base['font'] = item.font;

    // ── MODE 1: Reuse existing hydrated preview ───────────────────────────
    if (item.existingPreview) {
      log.debug('Reusing existing link preview', { id: item.id });
      return { ...base, ...item.existingPreview };
    }

    // ── MODE 2: Generate preview if URL present and generation enabled ─────
    if (item.generatePreview !== false && URL_REGEX.test(text)) {
      try {
        const baileys = require('@crysnovax/baileys') as Record<string, unknown>;
        const generateLinkPreviewIfRequired = baileys['generateLinkPreviewIfRequired'] as Function | undefined;

        if (generateLinkPreviewIfRequired && typeof sock['getUrlInfo'] === 'function') {
          const withPreview = await generateLinkPreviewIfRequired(
            text,
            sock['getUrlInfo'] as Function,
            {}
          ) as Record<string, unknown> | null;

          if (withPreview && Object.keys(withPreview).length > 0) {
            log.debug('Link preview generated', { id: item.id });
            return { ...base, ...withPreview };
          }
        }
      } catch (err) {
        // ── FALLBACK: send without preview ────────────────────────────────
        log.debug('Preview generation failed — sending without preview', { id: item.id, error: String(err) });
      }
    }

    return base;
  }

  // ── Image ─────────────────────────────────────────────────────────────────

  private buildImagePayload(item: StatusQueueItem): Record<string, unknown> {
    const media = this.resolveMedia(item);
    const payload: Record<string, unknown> = { image: media };
    if (item.text) payload['caption'] = item.text;
    if (item.mentions?.length) payload['mentions'] = item.mentions;
    return payload;
  }

  // ── Video ─────────────────────────────────────────────────────────────────

  private buildVideoPayload(item: StatusQueueItem): Record<string, unknown> {
    const media = this.resolveMedia(item);
    const payload: Record<string, unknown> = { video: media };
    if (item.text) payload['caption'] = item.text;
    if (item.mentions?.length) payload['mentions'] = item.mentions;
    return payload;
  }

  // ── Audio / Voice ─────────────────────────────────────────────────────────

  private buildAudioPayload(item: StatusQueueItem): Record<string, unknown> {
    const media = this.resolveMedia(item);
    return {
      audio: media,
      mimetype: item.mimeType ?? 'audio/ogg; codecs=opus',
      ptt: true,
    };
  }

  // ── Sticker ───────────────────────────────────────────────────────────────

  private buildStickerPayload(item: StatusQueueItem): Record<string, unknown> {
    return { sticker: this.resolveMedia(item) };
  }

  // ── Document ──────────────────────────────────────────────────────────────

  private buildDocumentPayload(item: StatusQueueItem): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      document: this.resolveMedia(item),
      fileName: item.fileName ?? 'file',
      mimetype: item.mimeType ?? 'application/octet-stream',
    };
    if (item.text) payload['caption'] = item.text;
    return payload;
  }

  // ── GIF ───────────────────────────────────────────────────────────────────

  private buildGifPayload(item: StatusQueueItem): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      video: this.resolveMedia(item),
      gifPlayback: true,
    };
    if (item.text) payload['caption'] = item.text;
    return payload;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private resolveMedia(item: StatusQueueItem): Buffer | { url: string } {
    if (item.mediaBuffer) return item.mediaBuffer;
    if (item.mediaUrl) return { url: item.mediaUrl };
    throw new Error(`No media provided for status item ${item.id}`);
  }

  /**
   * Validate a status item before queuing.
   * Throws with a descriptive message if invalid.
   */
  validate(item: Partial<StatusQueueItem>): void {
    const type = item.contentType;

    if (type === 'text') {
      if (!item.text?.trim()) throw new Error('Text status requires non-empty text');
      if (item.text.length > 700) throw new Error('Text status exceeds 700 character limit');
      return;
    }

    const hasMedia = item.mediaBuffer || item.mediaUrl;
    if (!hasMedia) throw new Error(`${type} status requires media (buffer or URL)`);

    if (item.mediaBuffer) {
      const maxBytes = this.maxSizeForType(type!);
      if (item.mediaBuffer.length > maxBytes) {
        throw new Error(`Media too large: ${item.mediaBuffer.length} bytes (max ${maxBytes})`);
      }
    }
  }

  private maxSizeForType(type: string): number {
    const limits: Record<string, number> = {
      image: 5 * 1024 * 1024,    // 5 MB
      video: 16 * 1024 * 1024,   // 16 MB
      audio: 16 * 1024 * 1024,   // 16 MB
      sticker: 500 * 1024,       // 500 KB
      document: 100 * 1024 * 1024, // 100 MB
      gif: 16 * 1024 * 1024,     // 16 MB
    };
    return limits[type] ?? 16 * 1024 * 1024;
  }
}
