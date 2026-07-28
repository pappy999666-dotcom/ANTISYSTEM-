/**
 * PAPPYBOT V2 — Telegram Control Panel Types
 */

// ── User Registration ─────────────────────────────────────────────────────────

export type RegistrationStep =
  | 'idle'
  | 'awaiting_name'
  | 'awaiting_domain'
  | 'awaiting_phone'
  | 'complete';

export interface TelegramUser {
  telegramId: number;
  displayName: string;
  domain?: string;
  baseUrl?: string;
  allocatedPort: number;
  defaultSessionId?: string;
  commandPrefix: string;
  language: string;
  timezone: string;
  notificationsEnabled: boolean;
  isBanned: boolean;
  registeredAt: number;
  lastActiveAt: number;
}

// ── Port Allocation ───────────────────────────────────────────────────────────

export interface PortAllocation {
  telegramId: number;
  port: number;
  allocatedAt: number;
}

// ── Bridge Mode ───────────────────────────────────────────────────────────────

export interface BridgeSession {
  telegramId: number;
  sessionId: string;
  groupJid: string;
  groupName: string;
  activatedAt: number;
}

// ── VPS Config ────────────────────────────────────────────────────────────────

export interface VpsConfig {
  ip?: string;
  domain?: string;
  baseUrl?: string;
}

// ── Broadcast ─────────────────────────────────────────────────────────────────

export type BroadcastStatus = 'pending' | 'running' | 'done' | 'cancelled';

export interface BroadcastJob {
  id: string;
  initiatorId: number;
  text?: string;
  mediaFileId?: string;
  mediaType?: 'photo' | 'video' | 'audio' | 'voice' | 'document';
  status: BroadcastStatus;
  delivered: number;
  failed: number;
  skipped: number;
  total: number;
  startedAt: number;
}

// ── Force Join ────────────────────────────────────────────────────────────────

export interface ForceJoinConfig {
  enabled: boolean;
  requiredChats: string[]; // channel/group usernames or IDs
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface PageState {
  page: number;
  pageSize: number;
  total: number;
}

// ── Callback Data ─────────────────────────────────────────────────────────────

export type CallbackAction =
  | 'dashboard'
  | 'sessions'
  | 'session_open'
  | 'session_rename'
  | 'session_reconnect'
  | 'session_logout'
  | 'session_delete'
  | 'session_settings'
  | 'pair_start'
  | 'pair_code'
  | 'pair_qr'
  | 'groups'
  | 'group_open'
  | 'group_bridge'
  | 'group_settings'
  | 'group_participants'
  | 'group_welcome'
  | 'group_templates'
  | 'group_refresh'
  | 'logs'
  | 'settings'
  | 'settings_notifications'
  | 'settings_domain'
  | 'settings_prefix'
  | 'settings_export'
  | 'settings_import'
  | 'owner_panel'
  | 'owner_users'
  | 'owner_broadcast'
  | 'owner_ban'
  | 'owner_unban'
  | 'owner_stats'
  | 'owner_maintenance'
  | 'owner_announce'
  | 'owner_force_join'
  | 'bridge_exit'
  | 'confirm_yes'
  | 'confirm_no'
  | 'back'
  | 'refresh'
  | 'noop'
  | string;

export interface CallbackData {
  action: CallbackAction;
  payload?: string;
  page?: number;
}
