/**
 * PAPPYBOT V2 — Telegram Middleware
 *
 * - authGuard: blocks banned users
 * - registrationGate: redirects unregistered users to onboarding
 * - ownerGuard: restricts to global owner only
 * - forceJoinCheck: verifies membership in required channels
 */

import type { Context, NextFunction } from 'grammy';
import { telegramStore } from '../core/TelegramStore';
import { logger } from '../../logger/Logger';

const log = logger.child('TelegramMiddleware');

const GLOBAL_OWNER_TG_ID = Number(process.env['TELEGRAM_OWNER_ID'] ?? '0');

export async function authGuard(ctx: Context, next: NextFunction): Promise<void> {
  const id = ctx.from?.id;
  if (!id) return;
  const user = telegramStore.getUser(id);
  if (user?.isBanned) {
    await ctx.reply('🚫 You are banned from using this bot.').catch(() => void 0);
    return;
  }
  telegramStore.touchUser(id);
  await next();
}

export async function registrationGate(ctx: Context, next: NextFunction): Promise<void> {
  const id = ctx.from?.id;
  if (!id) return;

  // Always allow /start and commands through
  const text = ctx.message?.text ?? '';
  if (text.startsWith('/')) {
    await next();
    return;
  }

  // Allow unregistered users through if they are mid-registration flow
  if (!telegramStore.isRegistered(id)) {
    const step = telegramStore.getStep(id);
    if (step === 'awaiting_name' || step === 'awaiting_domain') {
      await next();
      return;
    }
    await ctx.reply('👋 Please use /start to register first.').catch(() => void 0);
    return;
  }

  // Allow registered users through mid-pairing flow
  const step = telegramStore.getStep(id);
  if (step === 'awaiting_phone') {
    await next();
    return;
  }
  await next();
}

export async function ownerGuard(ctx: Context, next: NextFunction): Promise<void> {
  const id = ctx.from?.id;
  if (id !== GLOBAL_OWNER_TG_ID) {
    await ctx.answerCallbackQuery('⛔ Owner only.').catch(() => void 0);
    return;
  }
  await next();
}

export async function forceJoinCheck(ctx: Context, next: NextFunction): Promise<void> {
  const fj = telegramStore.getForceJoin();
  if (!fj.enabled || !fj.requiredChats.length) {
    await next();
    return;
  }

  const id = ctx.from?.id;
  if (!id) return;

  // Skip check for owner
  if (id === GLOBAL_OWNER_TG_ID) { await next(); return; }

  const bot = ctx.api;
  for (const chat of fj.requiredChats) {
    try {
      const member = await bot.getChatMember(chat, id);
      if (['left', 'kicked'].includes(member.status)) {
        await ctx.reply(
          `⚠️ <b>Access Restricted</b>\n\nYou must join the required channel to use this bot:\n${chat}`,
          { parse_mode: 'HTML' }
        ).catch(() => void 0);
        return;
      }
    } catch (err) {
      log.warn('Force join check failed', { chat, error: String(err) });
    }
  }
  await next();
}
