/**
 * PAPPYBOT V2 — Bridge Handler (Telegram ↔ WhatsApp)
 *
 * When a Telegram user has an active bridge session, their messages are
 * forwarded to the linked WhatsApp group. Commands (prefixed with .) are
 * executed as if typed inside that WhatsApp group — with the correct
 * session, group JID, owner, and sender context.
 *
 * Bridge context tracks:
 *   - Active session ID
 *   - Active WhatsApp group JID
 *   - Owner JID
 *   - Telegram user ID
 *
 * No command executes in the wrong group.
 */

import type { Context } from 'grammy';
import { telegramStore } from '../core/TelegramStore';
import { bridgeContextStore } from '../core/BridgeContext';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { CommandEngine } from '../../engines/CommandEngine';
import type { SessionManager } from '../../managers/SessionManager';
import type { ResponseEngine } from '../../engines/ResponseEngine';
import { R } from '../../ui/ResponseFormatter';
import { logger } from '../../logger/Logger';
import { normalizeJid } from '../../utils/jid';

const log = logger.child('BridgeHandler');

const TELEGRAM_BOT_TOKEN = process.env['TELEGRAM_BOT_TOKEN'] ?? '';

function fileUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
}

export async function handleBridgeMessage(
  ctx: Context,
  socketManager: SocketManager,
  commandEngine?: CommandEngine,
  sessionManager?: SessionManager,
  responseEngine?: ResponseEngine
): Promise<boolean> {
  const id = ctx.from?.id;
  if (!id) return false;

  // Use BridgeContext (set when user opens a group from Telegram)
  // Fall back to legacy TelegramStore bridge for backwards compat
  const bridgeCtx = bridgeContextStore.get(id);
  const legacyBridge = telegramStore.getBridge(id);

  const sessionId = bridgeCtx?.sessionId ?? legacyBridge?.sessionId;
  const groupJid  = bridgeCtx?.groupJid  ?? legacyBridge?.groupJid;

  if (!sessionId || !groupJid) return false;

  const sock = socketManager.getSocket(sessionId);
  if (!sock) {
    await ctx.reply(R.error('Bridge session is not connected.')).catch(() => void 0);
    return true;
  }

  const msg = ctx.message;
  if (!msg) return false;

  const text = msg.text ?? msg.caption ?? '';

  // ── Command execution ──────────────────────────────────────────────────
  // If the message starts with the command prefix, execute it in the
  // correct WhatsApp group context via CommandEngine.
  const prefix = '.';
  if (text.startsWith(prefix) && commandEngine && sessionManager) {
    const session = sessionManager.get(sessionId);
    if (!session) {
      await ctx.reply(R.error('Session not found.')).catch(() => void 0);
      return true;
    }

    // Build a synthetic NormalizedMessage that looks like it came from
    // the linked WhatsApp group, sent by the bridge owner.
    const ownerJid = bridgeCtx?.ownerJid ?? session.config.owner;
    const botJid = normalizeJid((sock.user?.id as string) ?? ownerJid);

    const syntheticMessage = {
      id: `bridge-${Date.now()}`,
      sessionId,
      chatJid: groupJid,
      chatType: 'group' as const,
      sender: {
        jid: ownerJid || botJid,
        phone: (ownerJid || botJid).split('@')[0]!,
        displayName: ctx.from?.first_name,
        isBot: false,
      },
      type: 'text' as const,
      text,
      mentions: [],
      timestamp: Math.floor(Date.now() / 1000),
      isOwner: true,
      isCommand: true,
      raw: {},
    };

    // Capture replies and echo them back to Telegram
    const replies: string[] = [];
    const captureReply = async (replyText: string) => {
      replies.push(replyText);
      // Also send to WhatsApp group
      try {
        await sock.sendMessage(groupJid, { text: replyText });
      } catch { /* non-fatal */ }
    };

    const handled = await commandEngine.handle(syntheticMessage as never, session);

    if (handled) {
      // Echo any captured replies back to Telegram
      for (const r of replies) {
        await ctx.reply(r, { parse_mode: 'Markdown' }).catch(() => void 0);
      }
      await ctx.react('⚡').catch(() => void 0);
      return true;
    }
  }

  // ── Media/text forwarding ──────────────────────────────────────────────
  try {
    if (msg.text) {
      await sock.sendMessage(groupJid, { text: msg.text });
    } else if (msg.photo) {
      const photo = msg.photo[msg.photo.length - 1]!;
      const file = await ctx.api.getFile(photo.file_id);
      await sock.sendMessage(groupJid, { image: { url: fileUrl(file.file_path!) }, caption: msg.caption ?? '' });
    } else if (msg.video) {
      const file = await ctx.api.getFile(msg.video.file_id);
      await sock.sendMessage(groupJid, { video: { url: fileUrl(file.file_path!) }, caption: msg.caption ?? '' });
    } else if (msg.voice) {
      const file = await ctx.api.getFile(msg.voice.file_id);
      await sock.sendMessage(groupJid, { audio: { url: fileUrl(file.file_path!) }, mimetype: 'audio/ogg; codecs=opus', ptt: true });
    } else if (msg.audio) {
      const file = await ctx.api.getFile(msg.audio.file_id);
      await sock.sendMessage(groupJid, { audio: { url: fileUrl(file.file_path!) } });
    } else if (msg.document) {
      const file = await ctx.api.getFile(msg.document.file_id);
      await sock.sendMessage(groupJid, {
        document: { url: fileUrl(file.file_path!) },
        fileName: msg.document.file_name ?? 'file',
        mimetype: msg.document.mime_type ?? 'application/octet-stream',
      });
    } else if (msg.sticker) {
      const file = await ctx.api.getFile(msg.sticker.file_id);
      await sock.sendMessage(groupJid, { sticker: { url: fileUrl(file.file_path!) } });
    }

    await ctx.react('👍').catch(() => void 0);
    return true;
  } catch (err) {
    log.error('Bridge forward failed', { error: String(err) });
    await ctx.reply(R.error(`Failed to forward: ${String(err)}`)).catch(() => void 0);
    return true;
  }
}

/**
 * Activate bridge mode for a Telegram user.
 * Called when user opens a group from the Telegram panel.
 */
export function activateBridge(
  telegramId: number,
  sessionId: string,
  groupJid: string,
  groupName: string,
  ownerJid: string
): void {
  bridgeContextStore.set({ telegramId, sessionId, groupJid, groupName, ownerJid, activatedAt: Date.now() });
  // Also update legacy store for backwards compat
  telegramStore.setBridge(telegramId, sessionId, groupJid, groupName);
}

/**
 * Deactivate bridge mode for a Telegram user.
 */
export function deactivateBridge(telegramId: number): void {
  bridgeContextStore.clear(telegramId);
  telegramStore.clearBridge(telegramId);
}
