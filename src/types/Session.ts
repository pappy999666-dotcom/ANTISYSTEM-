/**
 * Session types for isolated WhatsApp account workspaces.
 */

export type SessionStatus =
  | 'initializing'
  | 'qr_pending'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'logged_out'
  | 'stream_replaced'
  | 'error'
  | 'banned'
  | 'destroyed';

export interface SessionConfig {
  /** Unique session identifier */
  id: string;
  /** Owner JID (WhatsApp number@s.whatsapp.net) */
  owner: string;
  /** Human-readable label */
  label?: string;
  /** Command prefix override for this session */
  commandPrefix?: string;
  /** Custom per-session settings */
  settings: Record<string, unknown>;
  /** Granted permissions above default */
  extraPermissions?: string[];
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  connectedAt?: Date;
  lastSeen?: Date;
  phoneNumber?: string;
  displayName?: string;
  error?: string;
  /** Last low-level connection update reason/code, when available. */
  lastDisconnectReason?: string;
  /** Number of reconnect attempts since last disconnect */
  reconnectAttempts: number;
}

export interface SessionRuntime {
  config: SessionConfig;
  state: SessionState;
  /** Namespaced database key prefix */
  dbNamespace: string;
  /** Namespaced cache key prefix */
  cacheNamespace: string;
}
