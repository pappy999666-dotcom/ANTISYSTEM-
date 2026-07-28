/**
 * PAPPYBOT V2 — Permission Helpers
 *
 * Pure helper functions for resolving WhatsApp-level permissions.
 * These operate on NormalizedMessage + GroupCache — no Baileys internals.
 *
 * Future prompts: wire these into CommandEngine's permission check pipeline.
 */

import type { NormalizedMessage } from '../types/Message';
import type { GroupCache } from './GroupCache';
import { isGroupJid } from '../utils/jid';

export interface PermissionContext {
  /** The message being processed. */
  message: NormalizedMessage;
  /** Session owner JID (global owner or session-owner). */
  ownerJid: string;
  /** JIDs that have sudo access. */
  sudoJids?: string[];
  /** Group cache — required for group-related helpers. */
  groupCache?: GroupCache;
  /** JID of the bot itself (the session account). */
  botJid?: string;
}

export class PermissionHelpers {
  /**
   * Whether the message originated in a group chat.
   */
  static isGroup(ctx: PermissionContext): boolean {
    return ctx.message.chatType === 'group';
  }

  /**
   * Whether the message originated in a private (1:1) chat.
   */
  static isPrivate(ctx: PermissionContext): boolean {
    return ctx.message.chatType === 'private';
  }

  /**
   * Whether the message sender is an admin (or super-admin) in the group.
   * Always false in private chats.
   */
  static isAdmin(ctx: PermissionContext): boolean {
    if (!PermissionHelpers.isGroup(ctx) || !ctx.groupCache) return false;
    return ctx.groupCache.isAdmin(ctx.message.chatJid, ctx.message.sender.jid);
  }

  /**
   * Whether the message sender is a super-admin (group creator) in the group.
   */
  static isSuperAdmin(ctx: PermissionContext): boolean {
    if (!PermissionHelpers.isGroup(ctx) || !ctx.groupCache) return false;
    const meta = ctx.groupCache.get(ctx.message.chatJid);
    return meta?.participants.some(
      p => p.jid === ctx.message.sender.jid && p.isSuperAdmin
    ) ?? false;
  }

  /**
   * Whether the message sender is the global owner of this bot instance.
   */
  static isOwner(ctx: PermissionContext): boolean {
    return ctx.message.sender.jid === ctx.ownerJid;
  }

  /**
   * Whether the message sender has sudo privileges.
   */
  static isSudo(ctx: PermissionContext): boolean {
    if (PermissionHelpers.isOwner(ctx)) return true;
    return ctx.sudoJids?.includes(ctx.message.sender.jid) ?? false;
  }

  /**
   * Whether the bot account is an admin in the group.
   */
  static isBotAdmin(ctx: PermissionContext): boolean {
    if (!PermissionHelpers.isGroup(ctx) || !ctx.groupCache || !ctx.botJid) return false;
    return ctx.groupCache.isAdmin(ctx.message.chatJid, ctx.botJid);
  }

  /**
   * Whether the sender is the session owner (the WhatsApp account the bot is running on).
   */
  static isSessionOwner(ctx: PermissionContext): boolean {
    if (!ctx.botJid) return false;
    return ctx.message.sender.jid === ctx.botJid;
  }

  /**
   * Whether the message chat JID is a group JID.
   * Convenience method using only the JID string (no context required).
   */
  static chatIsGroup(jid: string): boolean {
    return isGroupJid(jid);
  }

  /**
   * Resolve a permission level name for the sender.
   * Returns the highest level that applies.
   */
  static resolveLevel(
    ctx: PermissionContext
  ): 'GLOBAL_OWNER' | 'SESSION_OWNER' | 'SUDO' | 'ADMIN' | 'USER' {
    if (PermissionHelpers.isOwner(ctx)) return 'GLOBAL_OWNER';
    if (PermissionHelpers.isSessionOwner(ctx)) return 'SESSION_OWNER';
    if (PermissionHelpers.isSudo(ctx)) return 'SUDO';
    if (PermissionHelpers.isAdmin(ctx)) return 'ADMIN';
    return 'USER';
  }
}
