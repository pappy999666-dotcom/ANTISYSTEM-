/**
 * PAPPYBOT V2 — Group Management Type Definitions
 */

// ── Group History ────────────────────────────────────────────────────────────

export type GroupCreationStatus = 'pending' | 'created' | 'failed';

export interface GroupHistoryRecord {
  id: string;
  sessionId: string;
  groupJid: string;
  groupName: string;
  description?: string;
  creatorJid: string;
  promotionTarget?: string;
  inviteLink?: string;
  createdAt: number;
  status: GroupCreationStatus;
}

// ── Welcome / Goodbye ────────────────────────────────────────────────────────

export interface WelcomeConfig {
  enabled: boolean;
  template: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  /** Placeholder for future intro card URL button */
  introCardUrl?: string;
}

export interface GoodbyeConfig {
  enabled: boolean;
  template: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
}

// ── Admin Protection ─────────────────────────────────────────────────────────

export type AdminProtectionMode =
  | 'dwp'   // demote + warn + promote back
  | 'dnp'   // demote + no promote
  | 'kwp'   // kick + warn + promote back
  | 'knp';  // kick + no promote

export interface AdminProtectionConfig {
  antiDemote: boolean;
  antiPromote: boolean;
  demoteMode: AdminProtectionMode;
  promoteMode: AdminProtectionMode;
}

// ── Group Template ────────────────────────────────────────────────────────────

export interface GroupTemplates {
  groupJid: string;
  sessionId: string;
  templates: Record<string, string>;
}

// ── Participant Resolution ────────────────────────────────────────────────────

export interface ResolvedTarget {
  jid: string;
  phone: string;
  displayName?: string;
}

// ── Tag Engine ────────────────────────────────────────────────────────────────

export interface TagOptions {
  message?: string;
  mediaBuffer?: Buffer;
  mediaType?: 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document';
  mimeType?: string;
  fileName?: string;
  /** Reuse existing link preview metadata from a quoted/forwarded message */
  linkPreviewMetadata?: Record<string, unknown>;
  quotedKey?: Record<string, unknown>;
}
