/**
 * PAPPYBOT V2 — Report Service
 *
 * Handles anonymous uploads, confessions, smash-or-pass, and general reports.
 * Forwards to configured destination groups via SocketManager.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { ReportSubmission } from '../types/Web';
import type { SocketManager } from '../../whatsapp/SocketManager';
import { storageService } from '../storage/StorageService';
import { logger } from '../../logger/Logger';

const log = logger.child('ReportService');
const STORE_PATH = path.resolve('storage/report_store.json');

export class ReportService {
  private submissions = new Map<string, ReportSubmission>();
  private destinationGroupJid?: string;
  private destinationSessionId?: string;

  constructor(private readonly socketManager: SocketManager) {
    this.load();
  }

  setDestination(sessionId: string, groupJid: string): void {
    this.destinationSessionId = sessionId;
    this.destinationGroupJid = groupJid;
    this.save();
  }

  async submit(
    message: string,
    mediaFileIds: string[],
    whatsappNumber?: string,
    name?: string
  ): Promise<ReportSubmission> {
    const sub: ReportSubmission = {
      id: uuidv4(),
      whatsappNumber,
      name,
      message,
      mediaFiles: mediaFileIds,
      destinationGroupJid: this.destinationGroupJid,
      sessionId: this.destinationSessionId,
      submittedAt: Date.now(),
      forwarded: false,
    };

    this.submissions.set(sub.id, sub);
    this.save();

    if (this.destinationGroupJid && this.destinationSessionId) {
      await this.forward(sub.id).catch(err =>
        log.warn('Report forward failed', { id: sub.id, error: String(err) })
      );
    }

    return sub;
  }

  async forward(submissionId: string): Promise<void> {
    const sub = this.submissions.get(submissionId);
    if (!sub?.destinationGroupJid || !sub.sessionId) return;

    const sock = this.socketManager.getSocket(sub.sessionId);
    if (!sock) throw new Error('Session not connected');

    const lines = [
      `📬 *Anonymous Report*`,
      sub.name ? `Name: ${sub.name}` : null,
      sub.whatsappNumber ? `WA: ${sub.whatsappNumber}` : null,
      ``,
      sub.message,
      ``,
      `ID: ${sub.id}`,
      `Time: ${new Date(sub.submittedAt).toISOString()}`,
    ].filter(Boolean);

    await sock.sendMessage(sub.destinationGroupJid, { text: lines.join('\n') });

    for (const fileId of sub.mediaFiles) {
      const filePath = storageService.getPath(fileId);
      if (!filePath) continue;
      const buf = fs.readFileSync(filePath);
      const record = storageService.get(fileId);
      const mime = record?.mimeType ?? 'application/octet-stream';

      if (mime.startsWith('image/')) {
        await sock.sendMessage(sub.destinationGroupJid, { image: buf });
      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(sub.destinationGroupJid, { video: buf });
      } else {
        await sock.sendMessage(sub.destinationGroupJid, {
          document: buf,
          fileName: record?.originalName ?? 'file',
          mimetype: mime,
        });
      }
    }

    sub.forwarded = true;
    this.save();
  }

  getAll(): ReportSubmission[] {
    return [...this.submissions.values()];
  }

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      const data = {
        submissions: Object.fromEntries(this.submissions),
        destinationGroupJid: this.destinationGroupJid,
        destinationSessionId: this.destinationSessionId,
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      log.warn('Failed to save report store', { error: String(err) });
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as {
        submissions: Record<string, ReportSubmission>;
        destinationGroupJid?: string;
        destinationSessionId?: string;
      };
      for (const [k, v] of Object.entries(data.submissions ?? {})) this.submissions.set(k, v);
      this.destinationGroupJid = data.destinationGroupJid;
      this.destinationSessionId = data.destinationSessionId;
    } catch (err) {
      log.warn('Failed to load report store', { error: String(err) });
    }
  }
}
