/**
 * PAPPYBOT V2 — Anti System Type Definitions
 *
 * All shared types for the Anti System engine.
 * No business logic here — only contracts.
 */

// ── Detector ────────────────────────────────────────────────────────────────

export type DetectorId =
  | 'link'
  | 'bot'
  | 'spam'
  | 'picture'
  | 'video'
  | 'audio'
  | 'voice'
  | 'sticker'
  | 'text'
  | 'emoji'
  | 'poll'
  | 'forward'
  | 'channel'
  | 'groupcall'
  | 'words'
  | 'nsfw'
  | string; // extensible

export interface DetectionResult {
  detectorId: DetectorId;
  matched: boolean;
  /** 0–1 confidence score where applicable */
  confidence: number;
  /** Which rule/pattern triggered the match */
  matchedRule?: string;
  /** Extracted metadata (URLs found, word matched, etc.) */
  metadata: Record<string, unknown>;
  /** Execution time in ms */
  executionMs: number;
  /** Human-readable reason */
  reason?: string;
}

// ── Action ──────────────────────────────────────────────────────────────────

export type ActionType =
  | 'delete'
  | 'warn'
  | 'kick'
  | 'delete+warn'
  | 'delete+kick'
  | 'ignore'
  | 'log'
  | 'mute'    // future-ready
  | 'ban'     // future-ready
  | 'custom';

export interface ActionResult {
  action: ActionType;
  success: boolean;
  error?: string;
  executionMs: number;
}

// ── Permit ──────────────────────────────────────────────────────────────────

export interface Permit {
  /** JID that is permitted */
  jid: string;
  /** Which detector this permit applies to ('*' = all) */
  detectorId: DetectorId | '*';
  /** Group JID this permit applies to ('*' = all groups in session) */
  groupJid: string | '*';
  /** Session this permit belongs to */
  sessionId: string;
  /** Optional expiry timestamp (ms). undefined = permanent */
  expiresAt?: number;
  /** Who granted the permit */
  grantedBy: string;
  /** Human-readable reason */
  reason?: string;
  /** Optional notes */
  notes?: string;
  /** When the permit was created */
  createdAt: number;
}

// ── Rule ────────────────────────────────────────────────────────────────────

export interface AntiRule {
  detectorId: DetectorId;
  /** Action to take when this rule fires */
  action: ActionType;
  /** Minimum confidence to trigger (0–1). Default: 0.5 */
  minConfidence: number;
  /** Whether this rule is active */
  enabled: boolean;
  /** Custom message template key */
  templateKey?: string;
  /** Custom callback (for ActionType 'custom') */
  customCallback?: (ctx: AntiContext) => Promise<void>;
}

// ── Group Config ─────────────────────────────────────────────────────────────

export interface AntiGroupConfig {
  groupJid: string;
  sessionId: string;
  /** Per-detector enabled flags and settings */
  detectors: Partial<Record<DetectorId, DetectorConfig>>;
  /** Warn limit before auto-kick */
  warnLimit: number;
  /** Custom message templates */
  templates: Partial<Record<string, string>>;
  /** Last updated timestamp */
  updatedAt: number;
}

export interface DetectorConfig {
  enabled: boolean;
  action: ActionType;
  /** Detector-specific settings (e.g. spam threshold, allowed domains) */
  settings: Record<string, unknown>;
}

// ── Context ──────────────────────────────────────────────────────────────────

export interface AntiContext {
  sessionId: string;
  groupJid: string;
  senderJid: string;
  messageId: string;
  /** Raw Baileys message key for deletion */
  messageKey: Record<string, unknown>;
  detectionResult: DetectionResult;
  rule: AntiRule;
  groupConfig: AntiGroupConfig;
  /** Resolved template variables */
  templateVars: Record<string, string>;
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  sessionId: string;
  groupJid: string;
  senderJid: string;
  /** Moderator JID if applicable */
  moderatorJid?: string;
  detectorId: DetectorId;
  action: ActionType;
  reason: string;
  timestamp: number;
  executionMs: number;
  metadata: Record<string, unknown>;
}

// ── Warn ─────────────────────────────────────────────────────────────────────

export interface WarnRecord {
  id: string;
  sessionId: string;
  groupJid: string;
  userJid: string;
  reason: string;
  moderatorJid: string;
  timestamp: number;
  count: number;
}

// ── Ban ──────────────────────────────────────────────────────────────────────

export interface BanRecord {
  sessionId: string;
  groupJid: string;
  userJid: string;
  reason: string;
  moderatorJid: string;
  bannedAt: number;
  permanent: boolean;
  expiresAt?: number;
}

// ── Stats ────────────────────────────────────────────────────────────────────

export interface AntiStats {
  sessionId: string;
  groupJid: string;
  detections: Record<DetectorId, number>;
  actions: Record<ActionType, number>;
  permits: number;
  warns: number;
  kicks: number;
  bans: number;
  lastReset: number;
}

// ── Events ───────────────────────────────────────────────────────────────────

export interface AntiTriggeredEvent {
  sessionId: string;
  groupJid: string;
  senderJid: string;
  detectorId: DetectorId;
  action: ActionType;
  reason: string;
}

export interface WarnAddedEvent {
  sessionId: string;
  groupJid: string;
  userJid: string;
  count: number;
  limit: number;
  reason: string;
}

export interface WarnRemovedEvent {
  sessionId: string;
  groupJid: string;
  userJid: string;
  count: number;
}

export interface UserKickedEvent {
  sessionId: string;
  groupJid: string;
  userJid: string;
  reason: string;
}

export interface MessageDeletedEvent {
  sessionId: string;
  groupJid: string;
  messageId: string;
  reason: string;
}

export interface PermitAddedEvent {
  sessionId: string;
  groupJid: string;
  userJid: string;
  detectorId: DetectorId | '*';
}

export interface PermitRemovedEvent {
  sessionId: string;
  groupJid: string;
  userJid: string;
  detectorId: DetectorId | '*';
}

export interface ConfigChangedEvent {
  sessionId: string;
  groupJid: string;
  detectorId: DetectorId;
  key: string;
  oldValue: unknown;
  newValue: unknown;
}
