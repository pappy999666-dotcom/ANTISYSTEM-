/**
 * PAPPYBOT V2 — Storage Service
 *
 * Handles file uploads, temp storage, expiration, and cleanup.
 * Used by Intro System, Report System, and Anonymous Upload.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { UploadRecord } from '../types/Web';
import { logger } from '../../logger/Logger';

const log = logger.child('StorageService');

const STORAGE_ROOT = path.resolve('storage/uploads');
const META_PATH = path.resolve('storage/upload_meta.json');
const DEFAULT_EXPIRY_HOURS = 72;
const MAX_SIZE_MB = 50;

export class StorageService {
  private records = new Map<string, UploadRecord>();

  constructor() {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    this.loadMeta();
    // Cleanup every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  // ── Store ─────────────────────────────────────────────────────────────────

  store(
    originalName: string,
    buffer: Buffer,
    mimeType: string,
    type: UploadRecord['type'],
    expiryHours = DEFAULT_EXPIRY_HOURS
  ): UploadRecord {
    const id = uuidv4();
    const ext = path.extname(originalName) || this.extFromMime(mimeType);
    const fileName = `${id}${ext}`;
    const storedPath = path.join(STORAGE_ROOT, fileName);

    fs.writeFileSync(storedPath, buffer);

    const record: UploadRecord = {
      id,
      type,
      originalName,
      storedPath,
      mimeType,
      sizeBytes: buffer.length,
      uploadedAt: Date.now(),
      expiresAt: expiryHours > 0 ? Date.now() + expiryHours * 3600_000 : undefined,
    };

    this.records.set(id, record);
    this.saveMeta();
    log.debug('File stored', { id, originalName, sizeBytes: buffer.length });
    return record;
  }

  get(id: string): UploadRecord | undefined {
    return this.records.get(id);
  }

  getPath(id: string): string | undefined {
    const r = this.records.get(id);
    return r && fs.existsSync(r.storedPath) ? r.storedPath : undefined;
  }

  delete(id: string): boolean {
    const r = this.records.get(id);
    if (!r) return false;
    try { fs.unlinkSync(r.storedPath); } catch { /* already gone */ }
    this.records.delete(id);
    this.saveMeta();
    return true;
  }

  validateSize(sizeBytes: number, maxMb = MAX_SIZE_MB): boolean {
    return sizeBytes <= maxMb * 1024 * 1024;
  }

  validateType(mimeType: string, allowed: string[]): boolean {
    if (!allowed.length) return true;
    return allowed.some(a => mimeType.startsWith(a) || mimeType === a);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────

  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, r] of this.records) {
      if (r.expiresAt && now > r.expiresAt) {
        this.delete(id);
        removed++;
      }
    }
    if (removed) log.info('Storage cleanup', { removed });
    return removed;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private extFromMime(mime: string): string {
    const map: Record<string, string> = {
      'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp',
      'video/mp4': '.mp4', 'video/webm': '.webm',
      'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
      'application/pdf': '.pdf',
    };
    return map[mime] ?? '';
  }

  private saveMeta(): void {
    try {
      fs.writeFileSync(META_PATH, JSON.stringify([...this.records.values()], null, 2));
    } catch (err) {
      log.warn('Failed to save upload meta', { error: String(err) });
    }
  }

  private loadMeta(): void {
    try {
      if (!fs.existsSync(META_PATH)) return;
      const data = JSON.parse(fs.readFileSync(META_PATH, 'utf8')) as UploadRecord[];
      for (const r of data) this.records.set(r.id, r);
      log.info('Upload meta loaded', { count: this.records.size });
    } catch (err) {
      log.warn('Failed to load upload meta', { error: String(err) });
    }
  }
}

export const storageService = new StorageService();
