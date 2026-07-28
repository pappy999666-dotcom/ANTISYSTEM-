/**
 * PAPPYBOT V2 — Session Handler
 */

import type { Bot } from 'grammy';
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
} from '../ui/UIBuilder';
import type { App } from '../../core/App';
import type { SessionManager } from '../../managers/SessionManager';
import { InlineKeyboard } from 'grammy';

const PAGE_SIZE = 5;

export function registerSessionHandlers(bot: Bot, app: App, sessionManager: SessionManager): void {

  // ── List sessions ─────────────────────────────────────────────────────────

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

  // ── Open session card ─────────────────────────────────────────────────────

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

  // ── Reconnect ─────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_reconnect') { await next(); return; }

    await ctx.answerCallbackQuery('🔄 Reconnecting...');
    const sessionId = data.payload!;
    try {
      await app.startSession(sessionId);
      await ctx.editMessageText(successText('Reconnect initiated'), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Rename ────────────────────────────────────────────────────────────────

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

  // ── Logout ────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_logout') { await next(); return; }

    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;
    await ctx.editMessageText(
      `⚠️ <b>Logout Session</b>\n\nAre you sure you want to log out <code>${sessionId}</code>?`,
      { parse_mode: 'HTML', reply_markup: confirmKeyboard('session_logout_confirm', sessionId) }
    ).catch(() => void 0);
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'session_logout_confirm') { await next(); return; }

    await ctx.answerCallbackQuery('🚪 Logging out...');
    const sessionId = data.payload!;
    try {
      await app.stopSession(sessionId);
      sessionManager.remove(sessionId);
      await ctx.editMessageText(successText(`Session ${sessionId} logged out`), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Delete ────────────────────────────────────────────────────────────────

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
      await app.stopSession(sessionId);
      sessionManager.remove(sessionId);
      await ctx.editMessageText(successText(`Session ${sessionId} deleted`), { parse_mode: 'HTML' }).catch(() => void 0);
    } catch (err) {
      await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
    }
  });

  // ── Session settings ──────────────────────────────────────────────────────

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
      `</blockquote>\n\n` +
      `<i>AI Settings placeholder — coming in a future update.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('session_open', sessionId)),
    }).catch(() => void 0);
  });

  // ── Pair start ────────────────────────────────────────────────────────────

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

  // ── Pair method selection ─────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'pair_code' && data.action !== 'pair_qr') { await next(); return; }

    await ctx.answerCallbackQuery();
    const sessionId = data.payload!;

    if (data.action === 'pair_code') {
      await ctx.editMessageText(loadingText('Generating pairing code'), { parse_mode: 'HTML' }).catch(() => void 0);
      try {
        // Create session if not exists
        if (!sessionManager.get(sessionId)) {
          sessionManager.create({ id: sessionId, owner: '', label: sessionId, settings: {} });
        }
        const client = await app.startSession(sessionId);
        // The pairing code is emitted via session:pairing_code event — handled by NotificationService
        await ctx.editMessageText(pairingCodeText('Generating...', sessionId), {
          parse_mode: 'HTML',
          reply_markup: new InlineKeyboard().text('🔙 Back', cb('sessions')),
        }).catch(() => void 0);
      } catch (err) {
        await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
      }
    } else {
      await ctx.editMessageText(qrText(sessionId), {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', cb('sessions')),
      }).catch(() => void 0);
      try {
        if (!sessionManager.get(sessionId)) {
          sessionManager.create({ id: sessionId, owner: '', label: sessionId, settings: {} });
        }
        await app.startSession(sessionId);
      } catch (err) {
        await ctx.editMessageText(errorText(String(err)), { parse_mode: 'HTML' }).catch(() => void 0);
      }
    }
  });

  // ── Confirm no (cancel) ───────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'confirm_no') { await next(); return; }
    await ctx.answerCallbackQuery('Cancelled');
    await ctx.editMessageText('❌ Cancelled.', { reply_markup: new InlineKeyboard().text('🔙 Back', cb('dashboard')) }).catch(() => void 0);
  });
}

/** Called from text router — handles session rename input */
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

/** Called from text router — handles pair session name input */
export async function handlePairNameText(
  telegramId: number,
  text: string,
  sessionManager: SessionManager,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  const step = telegramStore.getStep(telegramId);
  if (step !== 'awaiting_name' || !telegramStore.isRegistered(telegramId)) return false;

  // Only handle if we're in pair flow (registered user)
  const sessionId = text.trim().toLowerCase().replace(/\s+/g, '_');
  telegramStore.clearStep(telegramId);

  await reply(
    `<b>📱 Pairing: ${sessionId}</b>\n\nChoose pairing method:`,
    {
      parse_mode: 'HTML',
      reply_markup: pairMethodKeyboard(sessionId),
    }
  );
  return true;
}
