/**
 * Internal event bus type definitions.
 * Every major action emits a typed event — modules communicate
 * through events, never direct imports of each other.
 */

import type { NormalizedMessage } from './Message';
import type { SessionState } from './Session';
import type { GroupMetadata } from './Group';

// Forward-declare to avoid circular import — MessageContext is in whatsapp/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageContextLike = any;

export interface PappybotEvents {
  // ── Session lifecycle ─────────────────────────────────────────────
  'session:created': { sessionId: string };
  'session:connected': { sessionId: string; phoneNumber: string };
  'session:disconnected': { sessionId: string; reason?: string };
  'session:reconnected': { sessionId: string; attempt: number };
  'session:qr': { sessionId: string; qr: string };
  'session:pairing_code': { sessionId: string; code: string };
  'session:error': { sessionId: string; error: Error };
  'session:state_changed': { sessionId: string; state: SessionState };
  'session:logged_out': { sessionId: string };
  'session:stream_replaced': { sessionId: string };
  'session:connecting': { sessionId: string };
  'session:connection_update': { sessionId: string; connection?: string; reason?: string; statusCode?: number };
  'session:retry_required': { sessionId: string; attempt: number; backoffMs: number; reason?: string };
  'session:restart_required': { sessionId: string; attempt: number; backoffMs: number };

  // ── Auth ──────────────────────────────────────────────────────────
  'auth:updated': { sessionId: string };

  // ── Messages ──────────────────────────────────────────────────────
  'message:received': { message: NormalizedMessage; context?: MessageContextLike };
  'message:deleted': { messageId: string; sessionId: string; chatJid: string };
  'message:sent': { messageId: string; sessionId: string; chatJid: string };
  'message:updated': { sessionId: string; messageId: string; chatJid: string };
  'message:reaction': { sessionId: string; messageId: string; senderJid: string; reaction: string };
  'message:poll_update': { sessionId: string; chatJid: string; messageId: string };
  'message:history_set': { sessionId: string; count: number; isLatest?: boolean };

  // ── Receipts / Presence ───────────────────────────────────────────
  'receipt:updated': { sessionId: string; chatJid: string; messageIds: string[] };
  'presence:updated': { sessionId: string; chatJid: string; jid: string; presence: string };

  // ── Calls ─────────────────────────────────────────────────────────
  'call:incoming': { sessionId: string; callId: string; callerJid: string };
  'call:rejected': { sessionId: string; callId: string };
  'call:ended': { sessionId: string; callId: string };

  // ── Commands ──────────────────────────────────────────────────────
  'command:executed': {
    commandName: string;
    sessionId: string;
    senderJid: string;
    success: boolean;
    durationMs: number;
  };
  'command:error': {
    commandName: string;
    sessionId: string;
    error: Error;
  };
  'command:cooldown': {
    commandName: string;
    sessionId: string;
    senderJid: string;
    remainingMs: number;
  };

  // ── Groups ────────────────────────────────────────────────────────
  'group:updated': { sessionId: string; groupJid: string; metadata?: GroupMetadata };
  'group:upserted': { sessionId: string; groupJid: string };
  'group:participant_added': { sessionId: string; groupJid: string; jid: string };
  'group:participant_removed': { sessionId: string; groupJid: string; jid: string };
  'group:participant_promoted': { sessionId: string; groupJid: string; jid: string };
  'group:participant_demoted': { sessionId: string; groupJid: string; jid: string };
  'group:join_approval': { sessionId: string; groupJid: string; participantJids: string[]; action: string };

  // ── Contacts ──────────────────────────────────────────────────────
  'contact:upserted': { sessionId: string; jid: string };
  'contact:updated': { sessionId: string; jid: string };

  // ── Profile ───────────────────────────────────────────────────────
  'profile:updated': { sessionId: string; jid: string };
  'profile:picture_updated': { sessionId: string; jid: string };
  'profile:name_updated': { sessionId: string; jid: string; name?: string };

  // ── Media ─────────────────────────────────────────────────────────
  'media:uploaded': { sessionId: string; type: string; size: number };
  'media:downloaded': { sessionId: string; type: string; messageId: string };

  // ── Block list ────────────────────────────────────────────────────
  'blocklist:updated': { sessionId: string; added: string[]; removed: string[] };

  // ── App state / Chats ─────────────────────────────────────────────
  'chats:updated': { sessionId: string; chatJids: string[] };
  'app_state:sync': { sessionId: string; name: string };
  'newsletter:updated': { sessionId: string; newsletterJid: string; update: Record<string, unknown> };
  'status:updated': { sessionId: string; chatJid: string; update: Record<string, unknown> };

  // ── Scheduler ─────────────────────────────────────────────────────
  'task:scheduled': { jobId: string; cron: string };
  'task:executed': { jobId: string; durationMs: number };
  'task:failed': { jobId: string; error: Error };

  // ── Configuration ─────────────────────────────────────────────────
  'config:changed': { key: string; oldValue: unknown; newValue: unknown };

  // ── Plugins ───────────────────────────────────────────────────────
  'plugin:loaded': { pluginId: string };
  'plugin:unloaded': { pluginId: string };
  'plugin:error': { pluginId: string; error: Error };

  // ── Runtime Monitor ───────────────────────────────────────────────
  'monitor:snapshot': { sessionId: string; stats: Record<string, unknown> };

  // ── Anti System ───────────────────────────────────────────────────
  'anti:triggered': { sessionId: string; groupJid: string; senderJid: string; detectorId: string; action: string; reason: string };
  'anti:message_deleted': { sessionId: string; groupJid: string; messageId: string; reason: string };
  'anti:user_kicked': { sessionId: string; groupJid: string; userJid: string; reason: string };
  'anti:user_banned': { sessionId: string; groupJid: string; userJid: string; reason: string; bannedAt: number; permanent: boolean };
  'anti:user_unbanned': { sessionId: string; groupJid: string; userJid: string };
  'anti:warn_added': { sessionId: string; groupJid: string; userJid: string; count: number; limit: number; reason: string };
  'anti:warn_removed': { sessionId: string; groupJid: string; userJid: string; count: number };
  'anti:permit_added': { sessionId: string; groupJid: string; userJid: string; detectorId: string };
  'anti:permit_removed': { sessionId: string; groupJid: string; userJid: string; detectorId: string };
  'anti:config_changed': { sessionId: string; groupJid: string; detectorId: string; key: string; oldValue: unknown; newValue: unknown };
}

export type EventName = keyof PappybotEvents;
export type EventPayload<E extends EventName> = PappybotEvents[E];

export type EventListener<E extends EventName> = (
  payload: EventPayload<E>
) => void | Promise<void>;
