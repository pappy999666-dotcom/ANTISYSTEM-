/**
 * PAPPYBOT V2 — Settings Handler
 */

import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { decodeCallback, cb } from '../core/CallbackRouter';
import { telegramStore } from '../core/TelegramStore';
import { settingsText, settingsKeyboard, successText, errorText } from '../ui/UIBuilder';
import type { TelegramUser } from '../types/Telegram';

export function registerSettingsHandlers(bot: Bot): void {

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings') { await next(); return; }

    await ctx.answerCallbackQuery();
    const user = telegramStore.requireUser(ctx.from!.id);
    await ctx.editMessageText(settingsText(user), {
      parse_mode: 'HTML',
      reply_markup: settingsKeyboard(),
    }).catch(() => void 0);
  });

  // ── Notifications toggle ──────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings_notifications') { await next(); return; }

    const user = telegramStore.requireUser(ctx.from!.id);
    telegramStore.updateUser(ctx.from!.id, { notificationsEnabled: !user.notificationsEnabled });
    await ctx.answerCallbackQuery(user.notificationsEnabled ? '🔕 Notifications off' : '🔔 Notifications on');
    const updated = telegramStore.requireUser(ctx.from!.id);
    await ctx.editMessageText(settingsText(updated), {
      parse_mode: 'HTML',
      reply_markup: settingsKeyboard(),
    }).catch(() => void 0);
  });

  // ── Domain ────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings_domain') { await next(); return; }

    await ctx.answerCallbackQuery();
    telegramStore.setStep(ctx.from!.id, 'awaiting_domain');
    await ctx.editMessageText(
      `<b>🌐 Update Domain</b>\n\nSend your new domain or base URL:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('settings')) }
    ).catch(() => void 0);
  });

  // ── Prefix ────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings_prefix') { await next(); return; }

    await ctx.answerCallbackQuery();
    // Use a special step marker
    telegramStore.users_setTempName(ctx.from!.id, '__prefix__');
    await ctx.editMessageText(
      `<b>⌨️ Command Prefix</b>\n\nSend your new command prefix (e.g. <code>!</code>, <code>.</code>, <code>/</code>):`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('settings')) }
    ).catch(() => void 0);
  });

  // ── Export ────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings_export') { await next(); return; }

    await ctx.answerCallbackQuery();
    const user = telegramStore.requireUser(ctx.from!.id);
    const exportData: Partial<TelegramUser> = { ...user };
    // Never export sensitive fields
    const safe = {
      displayName: exportData.displayName,
      domain: exportData.domain,
      commandPrefix: exportData.commandPrefix,
      language: exportData.language,
      timezone: exportData.timezone,
      notificationsEnabled: exportData.notificationsEnabled,
    };
    await ctx.reply(
      `<b>📤 Settings Export</b>\n\n<code>${JSON.stringify(safe, null, 2)}</code>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔙 Back', cb('settings')) }
    );
  });

  // ── Import ────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'settings_import') { await next(); return; }

    await ctx.answerCallbackQuery();
    telegramStore.users_setTempName(ctx.from!.id, '__import__');
    await ctx.editMessageText(
      `<b>📥 Import Settings</b>\n\nPaste your exported JSON settings:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('settings')) }
    ).catch(() => void 0);
  });
}

/** Called from text router — handles domain/prefix/import input */
export async function handleSettingsText(
  telegramId: number,
  text: string,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const step = telegramStore.getStep(telegramId);
  const tempMarker = telegramStore.getTempName(telegramId);

  // Prefix update
  if (tempMarker === '__prefix__') {
    const prefix = text.trim().slice(0, 3);
    telegramStore.updateUser(telegramId, { commandPrefix: prefix });
    await reply(successText(`Command prefix updated to: <code>${prefix}</code>`), { parse_mode: 'HTML' });
    return true;
  }

  // Import settings
  if (tempMarker === '__import__') {
    try {
      const data = JSON.parse(text) as Partial<TelegramUser>;
      const allowed: (keyof TelegramUser)[] = ['displayName', 'domain', 'commandPrefix', 'language', 'timezone', 'notificationsEnabled'];
      const patch: Partial<TelegramUser> = {};
      for (const key of allowed) {
        if (key in data) (patch as Record<string, unknown>)[key] = data[key];
      }
      telegramStore.updateUser(telegramId, patch);
      await reply(successText('Settings imported successfully'), { parse_mode: 'HTML' });
    } catch {
      await reply(errorText('Invalid JSON. Import failed.'), { parse_mode: 'HTML' });
    }
    return true;
  }

  // Domain update (from settings flow)
  if (step === 'awaiting_domain' && telegramStore.isRegistered(telegramId)) {
    const domain = text.startsWith('http') ? text : `https://${text}`;
    telegramStore.updateUser(telegramId, { domain });
    telegramStore.clearStep(telegramId);
    await reply(successText(`Domain updated to: <code>${domain}</code>`), { parse_mode: 'HTML' });
    return true;
  }

  return false;
}
