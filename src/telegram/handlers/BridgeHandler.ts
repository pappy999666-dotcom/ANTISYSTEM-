/**
 * PAPPYBOT V2 — Bridge Message Handler
 *
 * When a user has an active bridge session, their Telegram messages
 * are forwarded to the target WhatsApp group via SendMessageService.
 */

import type { Bot, Context } from 'grammy';
import { telegramStore } from '../core/TelegramStore';
import type { SocketManager } from '../../whatsapp/SocketManager';
import { logger } from '../../logger/Logger';

const log = logger.child('BridgeHandler');

export function registerBridgeHandlers(bot: Bot, socketManager: SocketManager): void {
  // This is called from the main text/media router — see TelegramBot.ts
}

export async function handleBridgeMessage(
  ctx: Context,
  socketManager: SocketManager
): Promise<boolean> {
  const id = ctx.from?.id;
  if (!id) return false;

  const bridge = telegramStore.getBridge(id);
  if (!bridge) return false;

  const sock = socketManager.getSocket(bridge.sessionId);
  if (!sock) {
    await ctx.reply('❌ Bridge session is not connected.').catch(() => void 0);
    return true;
  }

  try {
    const msg = ctx.message;
    if (!msg) return false;

    if (msg.text) {
      await sock.sendMessage(bridge.groupJid, { text: msg.text });
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]!;
      const file = await ctx.api.getFile(photo.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, { image: { url }, caption: msg.caption ?? '' });
    } else if (msg.video) {
      const file = await ctx.api.getFile(msg.video.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, { video: { url }, caption: msg.caption ?? '' });
    } else if (msg.voice) {
      const file = await ctx.api.getFile(msg.voice.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, { audio: { url }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
    } else if (msg.audio) {
      const file = await ctx.api.getFile(msg.audio.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, { audio: { url } });
    } else if (msg.document) {
      const file = await ctx.api.getFile(msg.document.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, {
        document: { url },
        fileName: msg.document.file_name ?? 'file',
        mimetype: msg.document.mime_type ?? 'application/octet-stream',
      });
    } else if (msg.sticker) {
      const file = await ctx.api.getFile(msg.sticker.file_id);
      const url = `https://api.telegram.org/file/bot${process.env['TELEGRAM_BOT_TOKEN']}/${file.file_path}`;
      await sock.sendMessage(bridge.groupJid, { sticker: { url } });
    }

    await ctx.react('👍').catch(() => void 0);
    return true;
  } catch (err) {
    log.error('Bridge forward failed', { error: String(err) });
    await ctx.reply(`❌ Failed to forward: ${String(err)}`).catch(() => void 0);
    return true;
  }
}
