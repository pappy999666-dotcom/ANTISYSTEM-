/**
 * PAPPYBOT V2 — Web Dashboard Types
 */

export interface WebUser {
  id: string;           // telegramId as string
  displayName: string;
  domain?: string;
  allocatedPort: number;
  isOwner: boolean;
  sessionIds: string[];
}

export interface AuthToken {
  userId: string;
  isOwner: boolean;
  iat: number;
  exp: number;
}

// ── Intro System ──────────────────────────────────────────────────────────────

export type QuestionType =
  | 'short'
  | 'paragraph'
  | 'multiple_choice'
  | 'checkbox';

export interface IntroQuestion {
  id: string;
  label: string;
  type: QuestionType;
  required: boolean;
  options?: string[];       // for multiple_choice / checkbox
  order: number;
  validation?: { minLength?: number; maxLength?: number; pattern?: string };
}

export interface IntroGroupConfig {
  groupJid: string;
  sessionId: string;
  enabled: boolean;
  welcomeMessage: string;
  questions: IntroQuestion[];
  destinationGroupJid?: string;
  forwardEnabled: boolean;
  mediaRequired: boolean;
  approvalRequired: boolean;
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  tokenExpiryHours: number;
  updatedAt: number;
}

export interface IntroToken {
  token: string;
  groupJid: string;
  sessionId: string;
  memberJid: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface IntroSubmission {
  id: string;
  token: string;
  groupJid: string;
  sessionId: string;
  memberJid: string;
  answers: Record<string, string | string[]>;
  mediaFiles: string[];   // stored file paths
  submittedAt: number;
  forwarded: boolean;
}

// ── Upload / Report ───────────────────────────────────────────────────────────

export interface UploadRecord {
  id: string;
  type: 'intro' | 'report' | 'anonymous';
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: number;
  expiresAt?: number;
}

export interface ReportSubmission {
  id: string;
  whatsappNumber?: string;
  name?: string;
  message: string;
  mediaFiles: string[];
  destinationGroupJid?: string;
  sessionId?: string;
  submittedAt: number;
  forwarded: boolean;
}

// ── WebSocket ─────────────────────────────────────────────────────────────────

export type WsEventType =
  | 'session:connected'
  | 'session:disconnected'
  | 'session:state'
  | 'session:state_changed'
  | 'session:qr'
  | 'session:pairing_code'
  | 'session:pairing_status'
  | 'session:pair_completed'
  | 'session:pair_failed'
  | 'session:reconnect_started'
  | 'session:reconnect_completed'
  | 'session:reconnect_failed'
  | 'session:health_changed'
  | 'log:line'
  | 'runtime:snapshot'
  | 'monitor:snapshot'
  | 'intro:submitted'
  | 'upload:complete'
  | 'group:updated'
  | 'group:created'
  | 'anti:triggered'
  | 'anti:warn_added'
  | 'notification'
  | 'ping';

export interface WsMessage {
  type: WsEventType;
  payload: unknown;
  ts: number;
}
