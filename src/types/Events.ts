/**
 * Internal event bus type definitions.
 * Every major action emits a typed event — modules communicate
 * through events, never direct imports of each other.
 */

import type { NormalizedMessage } from './Message';
import type { SessionState } from './Session';

export interface PappybotEvents {
  // ── Session lifecycle ─────────────────────────────────────────────
  'session:created': { sessionId: string };
  'session:connected': { sessionId: string; phoneNumber: string };
  'session:disconnected': { sessionId: string; reason?: string };
  'session:qr': { sessionId: string; qr: string };
  'session:error': { sessionId: string; error: Error };
  'session:state_changed': { sessionId: string; state: SessionState };

  // ── Messages ──────────────────────────────────────────────────────
  'message:received': { message: NormalizedMessage };
  'message:deleted': { messageId: string; sessionId: string; chatJid: string };
  'message:sent': { messageId: string; sessionId: string; chatJid: string };

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
  'group:updated': { sessionId: string; groupJid: string };
  'group:participant_added': { sessionId: string; groupJid: string; jid: string };
  'group:participant_removed': { sessionId: string; groupJid: string; jid: string };

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
}

export type EventName = keyof PappybotEvents;
export type EventPayload<E extends EventName> = PappybotEvents[E];

export type EventListener<E extends EventName> = (
  payload: EventPayload<E>
) => void | Promise<void>;
