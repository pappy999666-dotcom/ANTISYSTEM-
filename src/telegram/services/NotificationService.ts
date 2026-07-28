/**
 * PAPPYBOT V2 — Telegram Notification Service
 *
 * Subscribes to internal EventBus events and pushes
 * Telegram notifications to users who own the affected session.
 */

import type { Bot } from 'grammy';
import type { EventBus } from '../../events/EventBus';
import { telegramStore } from '../core/TelegramStore';
import { logger } from '../../logger/Logger';

const log = logger.child('NotificationService');

export class NotificationService {
  private readonly bot: Bot;
  private readonly bus: EventBus;
  private readonly unsubscribers: Array<() => void> = [];

  constructor(bot: Bot, bus: EventBus) {
    this.bot = bot;
    this.bus = bus;
  }

  start(): void {
    const on = <E extends string>(event: E, handler: (p: Record<string, unknown>) => Promise<void>) => {
      const id = this.bus.on(event as never, handler as never);
      this.unsubscribers.push(() => this.bus.off(id));
    };

    on('session:connected', async (p) => {
      await this.notify(p['sessionId'] as string,
        `🟢 <b>WhatsApp Connected</b>\nSession: <code>${p['sessionId']}</code>\nPhone: ${p['phoneNumber'] ?? 'N/A'}`);
    });

    on('session:disconnected', async (p) => {
      await this.notify(p['sessionId'] as string,
        `🔴 <b>WhatsApp Disconnected</b>\nSession: <code>${p['sessionId']}</code>\nReason: ${p['reason'] ?? 'unknown'}`);
    });

    on('session:logged_out', async (p) => {
      await this.notify(p['sessionId'] as string,
        `⚫ <b>Session Logged Out</b>\nSession: <code>${p['sessionId']}</code>`);
    });

    on('session:error', async (p) => {
      await this.notify(p['sessionId'] as string,
        `❌ <b>Session Error</b>\nSession: <code>${p['sessionId']}</code>\n${String((p['error'] as Error)?.message ?? p['error'])}`);
    });

    on('anti:user_banned', async (p) => {
      await this.notify(p['sessionId'] as string,
        `🚫 <b>User Banned</b>\nGroup: <code>${p['groupJid']}</code>\nUser: <code>${p['userJid']}</code>\nReason: ${p['reason']}`);
    });

    on('anti:warn_added', async (p) => {
      await this.notify(p['sessionId'] as string,
        `⚠️ <b>Warning Issued</b>\nGroup: <code>${p['groupJid']}</code>\nUser: <code>${p['userJid']}</code>\nWarns: ${p['count']}/${p['limit']}`);
    });

    on('group:created', async (p) => {
      await this.notify(p['sessionId'] as string,
        `✅ <b>Group Created</b>\n${p['subject']}\nJID: <code>${p['groupJid']}</code>`);
    });

    log.info('Notification service started');
  }

  stop(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers.length = 0;
  }

  async sendTo(telegramId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessage(telegramId, text, { parse_mode: 'HTML' });
    } catch (err) {
      log.warn('Failed to send notification', { telegramId, error: String(err) });
    }
  }

  private async notify(sessionId: string, text: string): Promise<void> {
    // Find users who own this session
    const users = telegramStore.getAllUsers().filter(
      u => u.notificationsEnabled && !u.isBanned && u.defaultSessionId === sessionId
    );
    for (const u of users) {
      await this.sendTo(u.telegramId, text);
    }
  }
}
