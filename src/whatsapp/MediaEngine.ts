/**
 * PAPPYBOT V2 — Media Engine
 *
 * Handles media download, upload, temporary storage, cleanup,
 * MIME detection, size validation, and media type detection.
 *
 * Used by:
 *   - Command handlers that process user-sent media
 *   - ProfileService (profile picture upload)
 *   - GroupService (group picture update)
 *   - Future anti-abuse module
 *
 * Extension points:
 *   - Future prompt: integrate a cloud storage adapter for large files.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../logger/Logger';
import type { SocketManager } from './SocketManager';
import type { EventBus } from '../events/EventBus';
import {
  type MediaInfo,
  type MediaType,
  type MediaDownloadOptions,
  MEDIA_SIZE_LIMITS,
} from '../types/Media';

const log = logger.child('MediaEngine');

// ── MIME → MediaType mapping ───────────────────────────────────────────────

const MIME_TYPE_MAP: Record<string, MediaType> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'image/bmp': 'image',
  'video/mp4': 'video',
  'video/mpeg': 'video',
  'video/3gpp': 'video',
  'video/quicktime': 'video',
  'video/webm': 'video',
  'audio/mp4': 'audio',
  'audio/mpeg': 'audio',
  'audio/ogg; codecs=opus': 'voice',
  'audio/ogg': 'voice',
  'audio/wav': 'audio',
  'audio/aac': 'audio',
  'audio/amr': 'audio',
};

// Magic byte signatures for MIME detection
const MAGIC_BYTES: Array<{ bytes: number[]; offset?: number; mime: string }> = [
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },
  { bytes: [0x89, 0x50, 0x4e, 0x47], mime: 'image/png' },
  { bytes: [0x52, 0x49, 0x46, 0x46], mime: 'image/webp', offset: 0 },
  { bytes: [0x47, 0x49, 0x46], mime: 'image/gif' },
  { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
  { bytes: [0x1a, 0x45, 0xdf, 0xa3], mime: 'video/webm' },
  { bytes: [0x4f, 0x67, 0x67, 0x53], mime: 'audio/ogg' },
  { bytes: [0xff, 0xfb], mime: 'audio/mpeg' },
  { bytes: [0xff, 0xf3], mime: 'audio/mpeg' },
  { bytes: [0x49, 0x44, 0x33], mime: 'audio/mpeg' },
];

export class MediaEngine {
  private readonly socketManager: SocketManager;
  private readonly bus: EventBus;
  private readonly tempDir: string;
  /** Track temp files for cleanup. */
  private readonly tempFiles = new Set<string>();

  constructor(socketManager: SocketManager, bus: EventBus, tempDir?: string) {
    this.socketManager = socketManager;
    this.bus = bus;
    this.tempDir = tempDir ?? path.join(os.tmpdir(), 'pappybot-media');
    fs.mkdirSync(this.tempDir, { recursive: true });
  }

  // ── Download ──────────────────────────────────────────────────────────

  /**
   * Download a media message from WhatsApp.
   * Returns a Buffer with the decrypted media content.
   *
   * @param sessionId  - Session to use for decryption keys.
   * @param rawMessage - Raw Baileys WAMessage object.
   * @param options    - Optional: max size limit or save path.
   */
  async downloadMedia(
    sessionId: string,
    rawMessage: unknown,
    options: MediaDownloadOptions = {}
  ): Promise<Buffer> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const baileys = require('@crysnovax/baileys') as Record<string, unknown>;
    const downloadMediaMessage = baileys['downloadMediaMessage'] as Function | undefined;

    if (!downloadMediaMessage) {
      throw new Error('downloadMediaMessage not found in @crysnovax/baileys');
    }

    const sock = this.socketManager.requireSocket(sessionId);
    const msg = rawMessage as Record<string, unknown>;

    // Detect media type and check size limits
    const mediaType = this.detectRawMessageMediaType(msg);
    const mediaMsg = this.extractMediaMessage(msg);
    if (mediaMsg) {
      const fileLength = (mediaMsg['fileLength'] as number | undefined) ?? 0;
      const limit = options.maxSizeBytes ?? (mediaType ? MEDIA_SIZE_LIMITS[mediaType] : Infinity);
      if (fileLength > limit) {
        throw new Error(
          `Media file size (${fileLength} bytes) exceeds limit (${limit} bytes)`
        );
      }
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const buffer = await downloadMediaMessage(
        rawMessage,
        'buffer',
        {},
        {
          logger: { level: 'silent' },
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          reuploadRequest: sock.updateMediaMessage,
        }
      ) as Buffer;

      if (options.saveTo) {
        fs.writeFileSync(options.saveTo, buffer);
        log.debug('Media saved to disk', { sessionId, path: options.saveTo });
      }

      await this.bus.emit('media:downloaded', {
        sessionId,
        type: mediaType ?? 'document',
        messageId: ((msg['key'] as Record<string, unknown>)?.['id'] as string) ?? '',
      });

      log.debug('Media downloaded', { sessionId, type: mediaType, size: buffer.length });
      return buffer;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Media download failed', { sessionId, error: error.message });
      throw error;
    }
  }

  // ── Temporary storage ─────────────────────────────────────────────────

  /**
   * Save a buffer to a temp file and return the path.
   * Register with cleanup() to remove later.
   */
  saveTempFile(buffer: Buffer, extension = 'bin'): string {
    const filename = `pappy_${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
    const filePath = path.join(this.tempDir, filename);
    fs.writeFileSync(filePath, buffer);
    this.tempFiles.add(filePath);
    log.trace('Temp file created', { path: filePath, size: buffer.length });
    return filePath;
  }

  /**
   * Remove a specific temp file.
   */
  removeTempFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      this.tempFiles.delete(filePath);
    } catch (err) {
      log.warn('Failed to remove temp file', { path: filePath, error: String(err) });
    }
  }

  /**
   * Clean up all tracked temp files (call on shutdown or periodically).
   */
  cleanupTempFiles(): number {
    let removed = 0;
    for (const filePath of this.tempFiles) {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          removed++;
        }
        this.tempFiles.delete(filePath);
      } catch {
        // Non-critical
      }
    }
    log.debug('Temp files cleaned', { removed });
    return removed;
  }

  /**
   * Remove temp files older than the given age (in ms).
   */
  cleanupOlderThan(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const filePath of this.tempFiles) {
      try {
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff) {
          fs.unlinkSync(filePath);
          this.tempFiles.delete(filePath);
          removed++;
        }
      } catch {
        this.tempFiles.delete(filePath);
      }
    }
    return removed;
  }

  // ── MIME & type detection ─────────────────────────────────────────────

  /**
   * Detect MIME type from a Buffer using magic bytes.
   * Returns 'application/octet-stream' if unknown.
   */
  detectMimeType(buffer: Buffer): string {
    for (const sig of MAGIC_BYTES) {
      const offset = sig.offset ?? 0;
      const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
      if (matches) return sig.mime;
    }
    return 'application/octet-stream';
  }

  /**
   * Resolve a MediaType from a MIME type string.
   */
  mimeToMediaType(mimeType: string): MediaType {
    const direct = MIME_TYPE_MAP[mimeType.toLowerCase()];
    if (direct) return direct;

    const prefix = mimeType.split('/')[0];
    if (prefix === 'image') return 'image';
    if (prefix === 'video') return 'video';
    if (prefix === 'audio') return 'audio';
    return 'document';
  }

  /**
   * Inspect a buffer and return full MediaInfo.
   */
  inspectBuffer(buffer: Buffer, fileName?: string): MediaInfo {
    const mimeType = this.detectMimeType(buffer);
    const type = this.mimeToMediaType(mimeType);

    // Validate size
    const limit = MEDIA_SIZE_LIMITS[type];
    if (buffer.length > limit) {
      throw new Error(
        `File size ${buffer.length} bytes exceeds ${type} limit of ${limit} bytes`
      );
    }

    return { mimeType, type, size: buffer.length, fileName };
  }

  /**
   * Validate that a buffer is within the size limit for its type.
   * Throws if over the limit.
   */
  validateSize(buffer: Buffer, type: MediaType): void {
    const limit = MEDIA_SIZE_LIMITS[type];
    if (buffer.length > limit) {
      throw new Error(
        `Media exceeds size limit: ${buffer.length} / ${limit} bytes for type "${type}"`
      );
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private detectRawMessageMediaType(msg: Record<string, unknown>): MediaType | undefined {
    const message = msg['message'] as Record<string, unknown> | undefined;
    if (!message) return undefined;
    if (message['imageMessage']) return 'image';
    if (message['videoMessage']) return 'video';
    if (message['audioMessage']) {
      const audio = message['audioMessage'] as Record<string, unknown>;
      return audio['ptt'] ? 'voice' : 'audio';
    }
    if (message['documentMessage']) return 'document';
    if (message['stickerMessage']) return 'sticker';
    return undefined;
  }

  private extractMediaMessage(msg: Record<string, unknown>): Record<string, unknown> | undefined {
    const message = msg['message'] as Record<string, unknown> | undefined;
    if (!message) return undefined;
    for (const key of [
      'imageMessage', 'videoMessage', 'audioMessage',
      'documentMessage', 'stickerMessage',
    ]) {
      if (message[key]) return message[key] as Record<string, unknown>;
    }
    return undefined;
  }
}
