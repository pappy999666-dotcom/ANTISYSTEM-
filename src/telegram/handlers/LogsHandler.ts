/**
 * PAPPYBOT V2 — Logs Handler
 */

import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { decodeCallback, cb } from '../core/CallbackRouter';
import { logsText, logsKeyboard } from '../ui/UIBuilder';

// In-memory ring buffer for recent log lines (populated by TelegramLogger)
const LOG_BUFFER: string[] = [];
const MAX_LINES = 30;

export function pushLogLine(line: string): void {
  LOG_BUFFER.push(line);
  if (LOG_BUFFER.length > MAX_LINES) LOG_BUFFER.shift();
}

export function registerLogsHandlers(bot: Bot): void {

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'logs') { await next(); return; }

    await ctx.answerCallbackQuery();
    const recent = LOG_BUFFER.slice(-15).reverse();
    await ctx.editMessageText(logsText(recent), {
      parse_mode: 'HTML',
      reply_markup: logsKeyboard(),
    }).catch(() => void 0);
  });

  // noop — absorbs unhandled callbacks silently
  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'noop') { await next(); return; }
    await ctx.answerCallbackQuery();
  });
}
