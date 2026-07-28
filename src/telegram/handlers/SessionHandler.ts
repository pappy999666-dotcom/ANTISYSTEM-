/**
 * PAPPYBOT V2 — Session Handler (Telegram)
 *
 * Pairing flow (Waiq-style):
 *   Tap "Pair Account" → send phone number → receive pairing code → scan in WhatsApp
 */

import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { decodeCallback, cb } from '../core/CallbackRouter';
import { telegramStore } from '../core/TelegramStore';
import {
  sessionsText,
  sessionsKeyboard,
  sessionCardText,
  sessionCardKeyboard,
  pairingCodeText,
  errorText,
  successText,
  confirmKeyboard,
  pairingStatusText,
  sessionHealthText,
} from '../ui/UIBuilder';
import type { App } from '../../core/App';
import type { SessionManager } from '../../managers/SessionManager';

const PAGE_SIZE = 5;

export function registerSessionHandlers(bot: Bot, app: App, sessionManager: SessionManager): void {

  // ── List sessions ──────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'sessions') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessions = sessionManager.getAll();
    const page = { page: data.page ?? 0, pageSize: PAGE_SIZE, total: sessions.length };
    await ctx.editMessageText(sessionsText(sessions), {
      parse_mode: 'HTML',
      reply_markup: sessionsKeyboard(sessions, page),
    }).catch(() => void 0);
  });

  // ── Open session card ──────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_open') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    const session = sessionManager.get(sessionId);
    if (!session) {
      await ctx.editMessageText(errorText('Session not found'), { parse_mode: 'HTML' }).catch(() => void 0);
      return;
    }
    await ctx.editMessageText(sessionCardText(session), {
      parse_mode: 'HTML',
      reply_markup: sessionCardKeyboard(sessionId),
    }).catch(() => void 0);
  });

  // ── Session health ─────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_health') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    const snap = app.sessionHealth?.getSnapshot(sessionId);
    if (!snap) {
      await ctx.editMessageText(errorText('Session not found'), { parse_mode: 'HTML' }).catch(() => void 0);
      return;
    }
    await ctx.editMessageText(sessionHealthText(snap), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('🔄 Refresh', cb('session_health', sessionId))
        .text('🔙 Back', cb('session_open', sessionId)),
    }).catch(() => void 0);
  });

  // ── Reconnect ──────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_reconnect') { await next(); return; }
    await ctx.answerCallbackQuery('🔄 Reconnecting...');
    const sessionId = data.payload!;
    try {
      await app.getContainer().resolve<import('../../pairing/ConnectionManager').ConnectionManager>('ConnectionManager').reconnect(sessionId);
      await ctx.editMessageText(successText('Reconnect initiated'), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Rename ─────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_rename') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    telegramStore.setPendingRename(ctx.from!.id, sessionId);
    await ctx.editMessageText(
      `✏️ <b>Rename Session</b>\n\nSend the new label for <code>${sessionId}</code>:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('session_open', sessionId)) }
    ).catch(() => void 0);
  });

  // ── Logout ─────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_logout') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    await ctx.editMessageText(
      `⚠️ <b>Logout Session</b>\n\nLog out <code>${sessionId}</code>?\n<i>Auth cleared — you will need to pair again.</i>`,
      { parse_mode: 'HTML', reply_markup: confirmKeyboard('session_logout_confirm', sessionId) }
    ).catch(() => void 0);
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_logout_confirm') { await next(); return; }
    await ctx.answerCallbackQuery('🚪 Logging out...');
    const sessionId = data.payload!;
    try {
      await app.logoutSession(sessionId);
      await ctx.editMessageText(successText(`Session ${sessionId} logged out`), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Delete ─────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_delete') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    await ctx.editMessageText(
      `🗑 <b>Delete Session</b>\n\nPermanently delete <code>${sessionId}</code> and all its data?`,
      { parse_mode: 'HTML', reply_markup: confirmKeyboard('session_delete_confirm', sessionId) }
    ).catch(() => void 0);
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_delete_confirm') { await next(); return; }
    await ctx.answerCallbackQuery('🗑 Deleting...');
    const sessionId = data.payload!;
    try {
      await app.deleteSession(sessionId);
      await ctx.editMessageText(successText(`Session ${sessionId} deleted`), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Session settings ───────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_settings') { await next(); return; }
    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    const session = sessionManager.get(sessionId);
    if (!session) { await ctx.answerCallbackQuery('Session not found'); return; }
    await ctx.editMessageText(
      `<b>⚙️ Session Settings</b>\n\n<blockquote>ID: <code>${sessionId}</code>\nPrefix: <code>${session.config.commandPrefix ?? '!'}</code>\nOwner: <code>${session.config.owner}</code></blockquote>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard()
          .text('📊 Health', cb('session_health', sessionId)).row()
          .text('🔙 Back', cb('session_open', sessionId)),
      }
    ).catch(() => void 0);
  });

  // ── Pair start — ask for phone number directly ─────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'pair_start') { await next(); return; }
    await ctx.answerCallbackQuery();
    telegramStore.setStep(ctx.from!.id, 'awaiting_phone');
    await ctx.editMessageText(
      `<b>📱 Pair Account</b>\n\n<blockquote>Send your phone number in international format.\n\nExample: <code>2348012345678</code>\n<i>(digits only — no + or spaces)</i></blockquote>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('sessions')) }
    ).catch(() => void 0);
  });

  // ── Cancel ─────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'confirm_no') { await next(); return; }
    await ctx.answerCallbackQuery('Cancelled');
    telegramStore.clearStep(ctx.from!.id);
    telegramStore.clearPendingPairSession(ctx.from!.id);
    await ctx.editMessageText('❌ Cancelled.', {
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('dashboard'))
    }).catch(() => void 0);
  });
}

// ── Text input handlers ────────────────────────────────────────────────────────

/** Handles session rename text input */
export async function handleSessionRenameText(
  telegramId: number,
  text: string,
  sessionManager: SessionManager,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const sessionId = telegramStore.getPendingRename(telegramId);
  if (!sessionId) return false;
  telegramStore.clearPendingRename(telegramId);
  const session = sessionManager.get(sessionId);
  if (!session) { await reply('❌ Session not found.'); return true; }
  sessionManager.updateConfig(sessionId, { label: text.trim() });
  await reply(`✅ Session renamed to: <b>${text.trim()}</b>`, { parse_mode: 'HTML' });
  return true;
}

/** No-op — session naming step removed. Kept for import compatibility. */
export async function handlePairNameText(): Promise<boolean> {
  return false;
}

/**
 * Handles phone number input for pairing.
 * Registered users only — unregistered users use registration flow.
 */
export async function handlePairPhoneText(
  telegramId: number,
  text: string,
  app: App,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  if (!telegramStore.isRegistered(telegramId)) return false;
  const step = telegramStore.getStep(telegramId);
  if (step !== 'awaiting_phone') return false;

  telegramStore.clearStep(telegramId);

  const phone = text.trim().replace(/\D/g, '');
  if (phone.length < 7 || phone.length > 15) {
    await reply('❌ Invalid number. Send digits only, e.g. <code>2348012345678</code>', { parse_mode: 'HTML' });
    return true;
  }

  await reply(
    `<blockquote>⏳ Requesting pairing code for <code>+${phone}</code>…</blockquote>`,
    { parse_mode: 'HTML' }
  );

  const sessionId = `sess_${phone}`;

  try {
    const result = await app.pairingEngine!.pair({
      sessionId,
      method: 'code',
      phoneNumber: phone,
      label: phone,
      customCode: 'PAPPYBOT', // exactly 8 chars
    });

    if (result.pairingCode) {
      await reply(pairingCodeText(result.pairingCode, phone), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('📱 Sessions', cb('sessions')),
      });
    } else {
      await reply(pairingStatusText(sessionId, 'waiting_code'), { parse_mode: 'HTML' });
    }
  } catch (err) {
    await reply(
      `<blockquote>❌ <b>Pairing Failed</b>\n\n<code>${String(err)}</code></blockquote>`,
      { parse_mode: 'HTML' }
    );
  }

  return true;
}
