/**
 * PAPPYBOT V2 — Broadcast Service
 *
 * Sends text, photo, video, audio, voice, or document to all registered users.
 * Tracks delivery stats and supports cancellation.
 */

import type { Bot, InputFile } from 'grammy';
import { telegramStore } from '../core/TelegramStore';
import type { BroadcastJob } from '../types/Telegram';
import { logger } from '../../logger/Logger';

const log = logger.child('BroadcastService');
const DELAY_MS = 50; // avoid Telegram flood limits

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export class BroadcastService {
  constructor(private readonly bot: Bot) {}

  async run(job: BroadcastJob, onProgress?: (job: BroadcastJob) => Promise<void>): Promise<void> {
    const users = telegramStore.getAllUsers().filter(u => !u.isBanned);
    telegramStore.updateBroadcast(job.id, { status: 'running', total: users.length });

    for (const user of users) {
      const current = telegramStore.getBroadcast(job.id);
      if (current?.status === 'cancelled') break;

      try {
        await this.sendOne(user.telegramId, job);
        telegramStore.updateBroadcast(job.id, { delivered: (current?.delivered ?? 0) + 1 });
      } catch {
        telegramStore.updateBroadcast(job.id, { failed: (current?.failed ?? 0) + 1 });
      }

      if (onProgress) await onProgress(telegramStore.getBroadcast(job.id)!);
      await sleep(DELAY_MS);
    }

    telegramStore.updateBroadcast(job.id, { status: 'done' });
    log.info('Broadcast complete', { id: job.id, delivered: telegramStore.getBroadcast(job.id)?.delivered });
  }

  private async sendOne(telegramId: number, job: BroadcastJob): Promise<void> {
    const api = this.bot.api;
    const text = job.text ?? '';
    const fid = job.mediaFileId;

    if (!fid) {
      await api.sendMessage(telegramId, text, { parse_mode: 'HTML' });
      return;
    }

    switch (job.mediaType) {
      case 'photo':
        await api.sendPhoto(telegramId, fid, { caption: text, parse_mode: 'HTML' });
        break;
      case 'video':
        await api.sendVideo(telegramId, fid, { caption: text, parse_mode: 'HTML' });
        break;
      case 'audio':
        await api.sendAudio(telegramId, fid, { caption: text, parse_mode: 'HTML' });
        break;
      case 'voice':
        await api.sendVoice(telegramId, fid, { caption: text, parse_mode: 'HTML' });
        break;
      case 'document':
        await api.sendDocument(telegramId, fid, { caption: text, parse_mode: 'HTML' });
        break;
      default:
        await api.sendMessage(telegramId, text, { parse_mode: 'HTML' });
    }
  }
}
