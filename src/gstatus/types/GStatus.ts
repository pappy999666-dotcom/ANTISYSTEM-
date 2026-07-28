/**
 * PAPPYBOT V2 — Group Status Engine Types
 *
 * WhatsApp Status (Stories) are sent to the special JID "status@broadcast".
 * Baileys supports this via the standard sendMessage API.
 * The STATUS_EXPIRY_SECONDS constant (86400 = 24h) is used for expiry metadata.
 *
 * Supported status content types (verified against @crysnovax/baileys):
 *   - text
 *   - image + caption
 *   - video + caption
 *   - audio (voice note)
 *   - sticker
 *   - document (sent as document message to status@broadcast)
 *   - GIF (video with gifPlayback=true)
 *
 * NOT supported by WhatsApp protocol for status:
 *   - Polls (status@broadcast does not support polls)
 *   - Location (not supported in status)
 *   - Contact cards (not supported in status)
 *   - Interactive buttons (not supported in status)
 *
 * Link previews: supported via generateLinkPreviewIfRequired from Baileys
 * when the text contains a URL. Existing hydrated previews from quoted
 * messages are preserved and reused without regeneration.
 */

export type StatusContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'sticker'
  | 'document'
  | 'gif';

export type StatusQueueItemStatus =
  | 'queued'
  | 'preparing'
  | 'sending'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export type PreviewMode = 'reuse' | 'generate' | 'none';

export interface StatusQueueItem {
  id: string;
  sessionId: string;
  /** Content type being sent */
  contentType: StatusContentType;
  /** Text content or caption */
  text?: string;
  /** Media buffer (image/video/audio/sticker/document/gif) */
  mediaBuffer?: Buffer;
  /** Media URL (alternative to buffer) */
  mediaUrl?: string;
  /** MIME type for audio/document */
  mimeType?: string;
  /** File name for document */
  fileName?: string;
  /** Mentions to include */
  mentions?: string[];
  /** Existing hydrated link preview metadata to reuse */
  existingPreview?: Record<string, unknown>;
  /** Whether to attempt link preview generation */
  generatePreview?: boolean;
  /** Background color for text statuses (ARGB hex) */
  backgroundColor?: string;
  /** Font type for text statuses */
  font?: number;
  /** Priority: higher = processed first */
  priority: number;
  /** Current queue status */
  status: StatusQueueItemStatus;
  /** Number of attempts made */
  attempts: number;
  /** Max retry attempts */
  maxRetries: number;
  /** Timestamp when queued */
  queuedAt: number;
  /** Timestamp when last attempted */
  lastAttemptAt?: number;
  /** Timestamp when completed */
  completedAt?: number;
  /** Error from last attempt */
  lastError?: string;
  /** Resulting message ID after successful send */
  messageId?: string;
}

export interface StatusMetrics {
  sessionId: string;
  totalSent: number;
  totalFailed: number;
  totalRetries: number;
  queueLength: number;
  avgSendTimeMs: number;
  byContentType: Record<StatusContentType, number>;
  previewsReused: number;
  previewsGenerated: number;
  lastUpdated: number;
}

export interface StatusEngineConfig {
  /** Delay between queue items in ms (default: 1500) */
  sendDelayMs: number;
  /** Max concurrent sends per session (default: 1 — WhatsApp rate limits) */
  maxConcurrent: number;
  /** Default max retries per item (default: 3) */
  defaultMaxRetries: number;
  /** Base retry backoff in ms (default: 2000) */
  retryBackoffMs: number;
  /** Max retry backoff in ms (default: 30000) */
  maxRetryBackoffMs: number;
  /** Whether to attempt link preview generation (default: true) */
  enablePreviewGeneration: boolean;
}

export const DEFAULT_STATUS_CONFIG: StatusEngineConfig = {
  sendDelayMs: 1500,
  maxConcurrent: 1,
  defaultMaxRetries: 3,
  retryBackoffMs: 2000,
  maxRetryBackoffMs: 30_000,
  enablePreviewGeneration: true,
};

/** The WhatsApp status broadcast JID — verified via isJidStatusBroadcast() */
export const STATUS_JID = 'status@broadcast';
