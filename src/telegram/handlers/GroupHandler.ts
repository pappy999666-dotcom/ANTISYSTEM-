/**
 * PAPPYBOT V2 — Group Handler
 */

import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { decodeCallback, cb } from '../core/CallbackRouter';
import { telegramStore } from '../core/TelegramStore';
import {
  groupsText,
  groupsKeyboard,
  groupDashboardText,
  groupDashboardKeyboard,
  bridgeActiveText,
  bridgeKeyboard,
  loadingText,
  errorText,
} from '../ui/UIBuilder';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { SessionManager } from '../../managers/SessionManager';

const PAGE_SIZE = 8;

export function registerGroupHandlers(bot: Bot, sessionManager: SessionManager, groupCache: GroupCache): void {

  // ── Group list ────────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'groups') { await next(); return; }

    await ctx.answerCallbackQuery();
    const sessionId = data.payload ?? sessionManager.getIds()[0];
    if (!sessionId) {
      await ctx.editMessageText('❌ No sessions available.', { reply_markup: new InlineKeyboard().text('🔙 Back', cb('dashboard')) }).catch(() => void 0);
      return;
    }

    await ctx.editMessageText(loadingText('Loading groups'), { parse_mode: 'HTML' }).catch(() => void 0);

    const allGroups = groupCache.getAll().map(g => ({
      jid: g.id,
      name: g.subject,
      isAdmin: g.participants.some(p => p.isAdmin),
    }));

    const page = { page: data.page ?? 0, pageSize: PAGE_SIZE, total: allGroups.length };
    await ctx.editMessageText(groupsText(sessionId, allGroups.length), {
      parse_mode: 'HTML',
      reply_markup: groupsKeyboard(allGroups, sessionId, page),
    }).catch(() => void 0);
  });

  // ── Group dashboard ───────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_open') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    if (!sessionId || !groupJid) { await ctx.answerCallbackQuery('Invalid group'); return; }

    const meta = groupCache.get(groupJid);
    if (!meta) {
      await ctx.editMessageText(errorText('Group not found in cache. Try refreshing.'), { parse_mode: 'HTML' }).catch(() => void 0);
      return;
    }

    await ctx.editMessageText(groupDashboardText(meta, sessionId, groupJid), {
      parse_mode: 'HTML',
      reply_markup: groupDashboardKeyboard(sessionId, groupJid),
    }).catch(() => void 0);
  });

  // ── Group refresh ─────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_refresh') { await next(); return; }
    await ctx.answerCallbackQuery('🔄 Refreshed');
    // Re-trigger group_open
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    const meta = groupCache.get(groupJid ?? '');
    if (!meta || !sessionId) return;
    await ctx.editMessageText(groupDashboardText(meta, sessionId, groupJid!), {
      parse_mode: 'HTML',
      reply_markup: groupDashboardKeyboard(sessionId, groupJid!),
    }).catch(() => void 0);
  });

  // ── Bridge mode ───────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_bridge') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    if (!sessionId || !groupJid) return;

    const meta = groupCache.get(groupJid);
    const groupName = meta?.subject ?? groupJid;

    telegramStore.setBridge(ctx.from!.id, sessionId, groupJid, groupName);

    await ctx.editMessageText(bridgeActiveText(groupName, sessionId), {
      parse_mode: 'HTML',
      reply_markup: bridgeKeyboard(),
    }).catch(() => void 0);
  });

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'bridge_exit') { await next(); return; }

    await ctx.answerCallbackQuery('🚪 Bridge closed');
    telegramStore.clearBridge(ctx.from!.id);
    await ctx.editMessageText('✅ Bridge mode exited.', {
      reply_markup: new InlineKeyboard().text('🔙 Dashboard', cb('dashboard')),
    }).catch(() => void 0);
  });

  // ── Group participants ────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_participants') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    const meta = groupCache.get(groupJid ?? '');
    if (!meta) { await ctx.answerCallbackQuery('Group not found'); return; }

    const admins = meta.participants.filter(p => p.isAdmin);
    const members = meta.participants.filter(p => !p.isAdmin);
    const lines = [
      `<b>👥 Participants — ${meta.subject}</b>\n`,
      `<b>Admins (${admins.length}):</b>`,
      ...admins.map(p => `  👑 <code>${p.jid.split('@')[0]}</code>`),
      `\n<b>Members (${members.length}):</b>`,
      ...members.slice(0, 20).map(p => `  👤 <code>${p.jid.split('@')[0]}</code>`),
      members.length > 20 ? `  <i>...and ${members.length - 20} more</i>` : '',
    ].filter(Boolean);

    await ctx.editMessageText(lines.join('\n'), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('group_open', `${sessionId}:${groupJid}`)),
    }).catch(() => void 0);
  });

  // ── Group welcome settings ────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_welcome') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    await ctx.editMessageText(
      `<b>👋 Welcome Settings</b>\n\n<i>Configure welcome/goodbye messages via WhatsApp commands in the group.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', cb('group_open', `${sessionId}:${groupJid}`)),
      }
    ).catch(() => void 0);
  });

  // ── Group templates ───────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_templates') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    await ctx.editMessageText(
      `<b>📝 Templates</b>\n\n<i>Manage message templates via WhatsApp commands in the group.</i>`,
      {
        parse_mode: 'HTML',
        reply_markup: new InlineKeyboard().text('🔙 Back', cb('group_open', `${sessionId}:${groupJid}`)),
      }
    ).catch(() => void 0);
  });

  // ── Group settings ────────────────────────────────────────────────────────

  bot.callbackQuery(/.*/, async (ctx, next) => {
    const data = decodeCallback(ctx.callbackQuery.data);
    if (data.action !== 'group_settings') { await next(); return; }

    await ctx.answerCallbackQuery();
    const [sessionId, groupJid] = (data.payload ?? '').split(':');
    const meta = groupCache.get(groupJid ?? '');
    if (!meta) { await ctx.answerCallbackQuery('Group not found'); return; }

    const text =
      `<b>⚙️ Group Settings — ${meta.subject}</b>\n\n` +
      `<blockquote>` +
      `Announce: ${meta.announce ? '🔒 On' : '🔓 Off'}\n` +
      `Restrict: ${meta.restrict ? '🔒 On' : '🔓 Off'}\n` +
      `Ephemeral: ${meta.ephemeralDuration ? `${meta.ephemeralDuration}s` : 'Off'}` +
      `</blockquote>\n\n` +
      `<i>Use WhatsApp commands to change group settings.</i>`;

    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().text('🔙 Back', cb('group_open', `${sessionId}:${groupJid}`)),
    }).catch(() => void 0);
  });
}
