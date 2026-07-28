/**
 * PAPPYBOT V2 — Dashboard Handler
 */

import type { Bot, Context } from 'grammy';
import { decodeCallback } from '../core/CallbackRouter';
import { telegramStore } from '../core/TelegramStore';
import { dashboardText, dashboardKeyboard, loadingText } from '../ui/UIBuilder';
import type { RuntimeMonitor } from '../../services/RuntimeMonitor';

export function registerDashboardHandlers(bot: Bot, monitor: RuntimeMonitor): void {

  bot.command('dashboard', async (ctx) => {
    const user = telegramStore.requireUser(ctx.from!.id);
    const snap = monitor.snapshot();
    await ctx.reply(dashboardText(snap, user), {
      parse_mode: 'HTML',
      reply_markup: dashboardKeyboard(),
    });
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'dashboard') { await next(); return; }

    await ctx.answerCallbackQuery();
    const user = telegramStore.requireUser(ctx.from!.id);
    const snap = monitor.snapshot();
    await ctx.editMessageText(dashboardText(snap, user), {
      parse_mode: 'HTML',
      reply_markup: dashboardKeyboard(),
    }).catch(() => void 0);
  });
}
