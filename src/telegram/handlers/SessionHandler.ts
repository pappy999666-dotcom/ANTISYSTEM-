/**
 * PAPPYBOT V2 — Session Handler (Telegram)
 *
 * Full pairing flow:
 *   pair_start → awaiting_name → method select → (code: awaiting_phone) → pair
 * Live status delivered via EventBus → NotificationService.
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
  pairMethodKeyboard,
  pairingCodeText,
  qrText,
  loadingText,
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
      `✏️ <b>Rename Session</b>\n\nSend the new name for session <code>${sessionId}</code>:`,
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
      `⚠️ <b>Logout Session</b>\n\nAre you sure you want to log out <code>${sessionId}</code>?\n\n<i>Auth will be cleared. You will need to pair again.</i>`,
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
      `🗑 <b>Delete Session</b>\n\nThis will permanently delete <code>${sessionId}</code> and all its data. Continue?`,
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

    const text =
      `<b>⚙️ Session Settings</b>\n\n` +
      `<blockquote>` +
      `ID: <code>${sessionId}</code>\n` +
      `Prefix: <code>${session.config.commandPrefix ?? '!'}</code>\n` +
      `Owner: <code>${session.config.owner}</code>` +
      `</blockquote>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text('📊 Health', cb('session_health', sessionId)).row()
        .text('🔙 Back', cb('session_open', sessionId)),
    }).catch(() => void 0);
  });

  // ── Pair start ─────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'pair_start') { await next(); return; }

    await ctx.answerCallbackQuery();
    telegramStore.setStep(ctx.from!.id, 'awaiting_name');
    await ctx.editMessageText(
      `<b>➕ Pair New Session</b>\n\nSend a name for this session (e.g. <code>main</code>, <code>business</code>):`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('sessions')) }
    ).catch(() => void 0);
  });

  // ── Pair method selection ──────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'pair_code' && data.action !== 'pair_qr') { await next(); return; }

    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;

    if (data.action === 'pair_qr') {
      // QR flow — start session immediately, QR arrives via EventBus → NotificationService
      await ctx.editMessageText(
        pairingStatusText(sessionId, 'connecting'),
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('sessions')) }
      ).catch(() => void 0);
      try {
        await app.pairingEngine!.pair({ sessionId, method: 'qr', label: sessionId });
      } catch (err) {
        await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
      }
    } else {
      // Code flow — ask for phone number first
      telegramStore.setStep(ctx.from!.id, 'awaiting_phone');
      telegramStore.setPendingPairSession(ctx.from!.id, sessionId);
      await ctx.editMessageText(
        `<b>🔢 Pairing Code</b>\n\nSession: <code>${sessionId}</code>\n\nSend your phone number in international format:\n<code>15551234567</code> <i>(no + or spaces)</i>`,
        { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('sessions')) }
      ).catch(() => void 0);
    }
  });

  // ── Cancel pairing ─────────────────────────────────────────────────────────

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

/** Handles pair session name input (step 1 of pairing flow) */
export async function handlePairNameText(
  telegramId: number,
  text: string,
  sessionManager: SessionManager,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const step = telegramStore.getStep(telegramId);
  if (step !== 'awaiting_name' || !telegramStore.isRegistered(telegramId)) return false;

  const sessionId = text.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
  if (!sessionId) { await reply('❌ Invalid session name. Use letters, numbers, _ or -.'); return true; }

  // Duplicate check
  if (sessionManager.getAll().some(s => s.config.id === sessionId || s.config.label === sessionId)) {
    await reply(`❌ Session name <code>${sessionId}</code> already in use.`, { parse_mode: 'HTML' });
    return true;
  }

  telegramStore.clearStep(telegramId);
  await reply(
    `<b>📱 Pairing: ${sessionId}</b>\n\nChoose pairing method:`,
    { parse_mode: 'HTML', reply_markup: pairMethodKeyboard(sessionId) }
  );
  return true;
}

/** Handles phone number input (step 2 of code pairing flow) */
export async function handlePairPhoneText(
  telegramId: number,
  text: string,
  app: App,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const step = telegramStore.getStep(telegramId);
  if (step !== 'awaiting_phone') return false;

  const sessionId = telegramStore.getPendingPairSession(telegramId);
  if (!sessionId) return false;

  telegramStore.clearStep(telegramId);
  telegramStore.clearPendingPairSession(telegramId);

  const phone = text.trim().replace(/\D/g, '');
  if (phone.length < 7 || phone.length > 15) {
    await reply('❌ Invalid phone number. Send digits only, e.g. <code>15551234567</code>', { parse_mode: 'HTML' });
    return true;
  }

  await reply(loadingText('Generating pairing code'), { parse_mode: 'HTML' });

  try {
    const result = await app.pairingEngine!.pair({
      sessionId,
      method: 'code',
      phoneNumber: phone,
      label: sessionId,
    });

    if (result.pairingCode) {
      await reply(pairingCodeText(result.pairingCode, sessionId), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Sessions', cb('sessions')),
      });
    } else {
      await reply(pairingStatusText(sessionId, 'waiting_code'), { parse_mode: 'HTML' });
    }
  } catch (err) {
    await reply(errorText(String(err)), { parse_mode: 'HTML' });
  }

  return true;
}
