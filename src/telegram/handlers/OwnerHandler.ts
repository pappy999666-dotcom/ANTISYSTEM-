/**
 * PAPPYBOT V2 — Owner Panel Handler
 */

import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { decodeCallback, cb } from '../core/CallbackRouter';
import { telegramStore } from '../core/TelegramStore';
import {
  ownerPanelText,
  ownerPanelKeyboard,
  loadingText,
  successText,
  errorText,
} from '../ui/UIBuilder';
import { BroadcastService } from '../services/BroadcastService';
import type { SessionManager } from '../../managers/SessionManager';
import type { RuntimeMonitor } from '../../services/RuntimeMonitor';

const GLOBAL_OWNER_TG_ID = Number(process.env['TELEGRAM_OWNER_ID'] ?? '0');

function isOwner(id: number): boolean {
  return id === GLOBAL_OWNER_TG_ID;
}

export function registerOwnerHandlers(
  bot: Bot,
  sessionManager: SessionManager,
  monitor: RuntimeMonitor
): void {
  const broadcastService = new BroadcastService(bot);

  // ── Owner panel ───────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_panel') { await next(); return; }

    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }
    await ctx.answerCallbackQuery();

    const userCount = telegramStore.getAllUsers().length;
    const sessionCount = sessionManager.count();
    await ctx.editMessageText(ownerPanelText(userCount, sessionCount), {
      parse_mode: 'HTML',
      reply_markup: ownerPanelKeyboard(),
    }).catch(() => void 0);
  });

  // ── Users list ────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_users') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    const users = telegramStore.getAllUsers();
    const lines = users.map(u =>
      `${u.isBanned ? '🚫' : '✅'} <b>${u.displayName}</b> (<code>${u.telegramId}</code>)\n  Port: ${u.allocatedPort} · ${u.domain ?? 'no domain'}`
    );
    const text = `<b>👥 All Users (${users.length})</b>\n\n` + (lines.join('\n\n') || '<i>No users yet.</i>');
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('owner_panel')),
    }).catch(() => void 0);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_stats') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    const snap = monitor.snapshot();
    const memMB = (snap.memory.rss / 1024 / 1024).toFixed(1);
    const heapMB = (snap.memory.heapUsed / 1024 / 1024).toFixed(1);
    const text =
      `<b>📊 System Statistics</b>\n\n` +
      `<blockquote>` +
      `Sessions: ${snap.sessions.length}\n` +
      `Connected: ${snap.sessions.filter(s => s.status === 'connected').length}\n` +
      `Memory RSS: ${memMB} MB\n` +
      `Heap Used: ${heapMB} MB\n` +
      `Messages ↓: ${snap.throughput.messagesReceived}\n` +
      `Messages ↑: ${snap.throughput.messagesSent}\n` +
      `Commands: ${snap.throughput.commandsExecuted}\n` +
      `Errors: ${snap.throughput.commandErrors}\n` +
      `Reconnects: ${snap.totalReconnects}` +
      `</blockquote>`;
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('owner_panel')),
    }).catch(() => void 0);
  });

  // ── Maintenance mode ──────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_maintenance') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    const current = telegramStore.isMaintenanceMode();
    telegramStore.setMaintenanceMode(!current);
    await ctx.answerCallbackQuery(current ? '✅ Maintenance OFF' : '🔧 Maintenance ON');
    await ctx.editMessageText(
      `<b>🔧 Maintenance Mode: ${!current ? 'ON' : 'OFF'}</b>`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🔙 Back', cb('owner_panel')) }
    ).catch(() => void 0);
  });

  // ── Force join ────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_force_join') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    const fj = telegramStore.getForceJoin();
    const text =
      `<b>🔗 Force Join</b>\n\n` +
      `Status: ${fj.enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
      `Required chats:\n${fj.requiredChats.map(c => `  • <code>${c}</code>`).join('\n') || '  <i>None</i>'}`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard()
        .text(fj.enabled ? '❌ Disable' : '✅ Enable', cb('owner_fj_toggle'))
        .text('➕ Add Chat', cb('owner_fj_add')).row()
        .text('🔙 Back', cb('owner_panel')),
    }).catch(() => void 0);
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_fj_toggle') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    const fj = telegramStore.getForceJoin();
    telegramStore.setForceJoin({ enabled: !fj.enabled });
    await ctx.answerCallbackQuery(fj.enabled ? '❌ Force join disabled' : '✅ Force join enabled');
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_fj_add') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    telegramStore.users_setTempName(ctx.from!.id, '__fj_add__');
    await ctx.editMessageText(
      `<b>➕ Add Required Chat</b>\n\nSend the channel/group username or ID:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('owner_force_join')) }
    ).catch(() => void 0);
  });

  // ── Broadcast ─────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_broadcast') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    telegramStore.users_setTempName(ctx.from!.id, '__broadcast__');
    await ctx.editMessageText(
      `<b>📡 Broadcast</b>\n\nSend the message to broadcast to all users.\nSupports text, photo, video, audio, voice, or document.`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('owner_panel')) }
    ).catch(() => void 0);
  });

  // ── Ban / Unban ───────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_ban' && data.action !== 'owner_unban') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    const action = data.action;
    telegramStore.users_setTempName(ctx.from!.id, `__${action}__`);
    await ctx.editMessageText(
      `<b>${action === 'owner_ban' ? '🚫 Ban' : '✅ Unban'} User</b>\n\nSend the Telegram user ID:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('owner_panel')) }
    ).catch(() => void 0);
  });

  // ── Announce ──────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'owner_announce') { await next(); return; }
    if (!isOwner(ctx.from!.id)) { await ctx.answerCallbackQuery('⛔ Owner only'); return; }

    await ctx.answerCallbackQuery();
    telegramStore.users_setTempName(ctx.from!.id, '__announce__');
    await ctx.editMessageText(
      `<b>📢 Announcement</b>\n\nSend the announcement text to send to all users:`,
      { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('❌ Cancel', cb('owner_panel')) }
    ).catch(() => void 0);
  });
}

/** Called from text/media router — handles owner input flows */
export async function handleOwnerText(
  telegramId: number,
  text: string,
  bot: Bot,
  broadcastService: BroadcastService,
  reply: (msg: string, opts?: Record<string, unknown>) => Promise<void>
): Promise<boolean> {
  if (!isOwner(telegramId)) return false;

  const marker = telegramStore.getTempName(telegramId);
  if (!marker) return false;

  if (marker === '__owner_ban__') {
    const targetId = Number(text.trim());
    if (!targetId) { await reply(errorText('Invalid user ID'), { parse_mode: 'HTML' }); return true; }
    telegramStore.banUser(targetId);
    await reply(successText(`User ${targetId} banned`), { parse_mode: 'HTML' });
    return true;
  }

  if (marker === '__owner_unban__') {
    const targetId = Number(text.trim());
    if (!targetId) { await reply(errorText('Invalid user ID'), { parse_mode: 'HTML' }); return true; }
    telegramStore.unbanUser(targetId);
    await reply(successText(`User ${targetId} unbanned`), { parse_mode: 'HTML' });
    return true;
  }

  if (marker === '__fj_add__') {
    const fj = telegramStore.getForceJoin();
    telegramStore.setForceJoin({ requiredChats: [...fj.requiredChats, text.trim()] });
    await reply(successText(`Added required chat: ${text.trim()}`), { parse_mode: 'HTML' });
    return true;
  }

  if (marker === '__announce__') {
    const users = telegramStore.getAllUsers().filter(u => !u.isBanned);
    const job = telegramStore.createBroadcast({
      initiatorId: telegramId,
      text,
      status: 'pending',
      delivered: 0,
      failed: 0,
      skipped: 0,
      total: users.length,
      startedAt: Date.now(),
    });
    await reply(loadingText(`Broadcasting to ${users.length} users`), { parse_mode: 'HTML' });
    broadcastService.run(job).catch(() => void 0);
    return true;
  }

  if (marker === '__broadcast__') {
    const users = telegramStore.getAllUsers().filter(u => !u.isBanned);
    const job = telegramStore.createBroadcast({
      initiatorId: telegramId,
      text,
      status: 'pending',
      delivered: 0,
      failed: 0,
      skipped: 0,
      total: users.length,
      startedAt: Date.now(),
    });
    await reply(loadingText(`Broadcasting to ${users.length} users`), { parse_mode: 'HTML' });
    broadcastService.run(job).catch(() => void 0);
    return true;
  }

  return false;
}
