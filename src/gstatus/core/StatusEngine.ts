/**
 * PAPPYBOT V2 — Status Engine
 *
 * Central orchestrator for all WhatsApp Group Status (Story) operations.
 *
 * Architecture:
 *   StatusEngine
 *     ├── StatusQueue        — per-session priority queue
 *     ├── RetryManager       — exponential backoff retry logic
 *     ├── MediaPreparationService — payload builder for all content types
 *     ├── StatusMetricsManager   — per-session metrics
 *     └── EventBus           — emits all status lifecycle events
 *
 * Status messages are sent to "status@broadcast" via the standard
 * Baileys sendMessage API. This is the only supported mechanism.
 *
 * One processing loop per session. Loops are started lazily on first enqueue
 * and stop automatically when the queue is empty.
 */

import { v4 as uuidv4 } from 'uuid';
import type { EventBus } from '../../events/EventBus';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { MediaEngine } from '../../whatsapp/MediaEngine';
import { StatusQueue } from './StatusQueue';
import { RetryManager } from './RetryManager';
import { MediaPreparationService } from './MediaPreparationService';
import { StatusMetricsManager } from './StatusMetricsManager';
import type {
  StatusQueueItem,
  StatusContentType,
  StatusEngineConfig,
} from '../types/GStatus';
import { DEFAULT_STATUS_CONFIG, STATUS_JID } from '../types/GStatus';
import { logger } from '../../logger/Logger';
import { nowMs } from '../../utils/time';

const log = logger.child('StatusEngine');

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export class StatusEngine {
  private readonly queues = new Map<string, StatusQueue>();
  private readonly processing = new Set<string>(); // sessionIds currently processing
  private readonly retryManager: RetryManager;
  private readonly mediaPrep: MediaPreparationService;
  private readonly metrics: StatusMetricsManager;
  private readonly config: StatusEngineConfig;

  constructor(
    private readonly socketManager: SocketManager,
    private readonly bus: EventBus,
    mediaEngine: MediaEngine,
    config: Partial<StatusEngineConfig> = {}
  ) {
    this.config = { ...DEFAULT_STATUS_CONFIG, ...config };
    this.retryManager = new RetryManager(this.config);
    this.mediaPrep = new MediaPreparationService(mediaEngine);
    this.metrics = new StatusMetricsManager();
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Enqueue a status item for sending.
   * Returns the queue item ID.
   */
  enqueue(
    sessionId: string,
    contentType: StatusContentType,
    opts: Partial<Omit<StatusQueueItem, 'id' | 'sessionId' | 'contentType' | 'status' | 'attempts' | 'queuedAt'>> = {}
  ): StatusQueueItem {
    // Validate before queuing
    this.mediaPrep.validate({ contentType, ...opts });

    const queue = this.getQueue(sessionId);
    const item = queue.enqueue(sessionId, contentType, {
      ...opts,
      maxRetries: opts.maxRetries ?? this.config.defaultMaxRetries,
    });

    this.metrics.setQueueLength(sessionId, queue.length());

    void this.bus.emit('status:queued' as never, {
      sessionId,
      statusId: item.id,
      contentType,
    } as never);

    log.info('Status queued', { sessionId, id: item.id, contentType });

    // Start processing loop if not already running
    if (!this.processing.has(sessionId)) {
      void this.processQueue(sessionId);
    }

    return item;
  }

  /**
   * Cancel a queued status item.
   */
  cancel(sessionId: string, statusId: string): boolean {
    const queue = this.queues.get(sessionId);
    if (!queue) return false;
    const ok = queue.cancel(statusId);
    if (ok) {
      void this.bus.emit('status:cancelled' as never, { sessionId, statusId } as never);
    }
    return ok;
  }

  /**
   * Get current queue status for a session.
   */
  getQueueStatus(sessionId: string): StatusQueueItem[] {
    return this.queues.get(sessionId)?.all() ?? [];
  }

  /**
   * Get metrics for a session.
   */
  getMetrics(sessionId: string) {
    return this.metrics.snapshot(sessionId);
  }

  getAllMetrics() {
    return this.metrics.all();
  }

  // ── Queue processor ───────────────────────────────────────────────────────

  private async processQueue(sessionId: string): Promise<void> {
    if (this.processing.has(sessionId)) return;
    this.processing.add(sessionId);

    log.debug('Queue processor started', { sessionId });

    try {
      while (true) {
        const queue = this.queues.get(sessionId);
        if (!queue) break;

        const item = queue.next();
        if (!item) break; // Queue empty

        await this.processItem(sessionId, item);
        this.metrics.setQueueLength(sessionId, queue.length());

        // Delay between sends to respect WhatsApp rate limits
        if (queue.next()) {
          await sleep(this.config.sendDelayMs);
        }
      }
    } finally {
      this.processing.delete(sessionId);
      log.debug('Queue processor finished', { sessionId });

      void this.bus.emit('status:queue_finished' as never, { sessionId } as never);

      // Prune old completed items
      this.queues.get(sessionId)?.prune();
    }
  }

  private async processItem(sessionId: string, item: StatusQueueItem): Promise<void> {
    const queue = this.getQueue(sessionId);

    queue.update(item.id, { status: 'preparing', lastAttemptAt: nowMs() });
    void this.bus.emit('status:started' as never, {
      sessionId,
      statusId: item.id,
      contentType: item.contentType,
      attempt: item.attempts + 1,
    } as never);

    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) {
      queue.update(item.id, { status: 'failed', lastError: 'Session not connected', completedAt: nowMs() });
      void this.bus.emit('status:failed' as never, {
        sessionId, statusId: item.id, error: 'Session not connected',
      } as never);
      this.metrics.recordFailed(sessionId);
      return;
    }

    const start = nowMs();
    item.attempts++;

    try {
      queue.update(item.id, { status: 'sending' });

      // Build payload
      const payload = await this.mediaPrep.buildPayload(item, sock as Record<string, unknown>);

      // Track preview mode
      if (item.existingPreview) {
        this.metrics.recordPreviewReused(sessionId);
        void this.bus.emit('status:preview_reused' as never, { sessionId, statusId: item.id } as never);
      } else if (payload['canonicalUrl'] || payload['matchedText']) {
        this.metrics.recordPreviewGenerated(sessionId);
        void this.bus.emit('status:preview_generated' as never, { sessionId, statusId: item.id } as never);
      }

      void this.bus.emit('status:media_prepared' as never, {
        sessionId, statusId: item.id, contentType: item.contentType,
      } as never);

      // Send to status@broadcast
      const result = await (sock as Record<string, Function>)['sendMessage'](STATUS_JID, payload) as Record<string, unknown> | undefined;
      const messageId = ((result?.['key'] as Record<string, unknown>)?.['id'] as string) ?? uuidv4();

      const durationMs = nowMs() - start;
      queue.update(item.id, { status: 'completed', messageId, completedAt: nowMs() });
      this.metrics.recordSent(sessionId, item.contentType, durationMs);

      void this.bus.emit('status:completed' as never, {
        sessionId,
        statusId: item.id,
        messageId,
        contentType: item.contentType,
        durationMs,
      } as never);

      log.info('Status sent', { sessionId, id: item.id, contentType: item.contentType, durationMs });

    } catch (err) {
      const error = String(err instanceof Error ? err.message : err);
      log.warn('Status send failed', { sessionId, id: item.id, attempt: item.attempts, error });

      if (this.retryManager.shouldRetry(item.attempts, item.maxRetries, error)) {
        const backoff = this.retryManager.backoffMs(item.attempts);
        queue.update(item.id, { status: 'retrying', lastError: error });
        this.metrics.recordRetry(sessionId);

        void this.bus.emit('status:retry' as never, {
          sessionId, statusId: item.id, attempt: item.attempts, backoffMs: backoff, error,
        } as never);

        log.debug('Retrying status', { sessionId, id: item.id, backoff });
        await sleep(backoff);
        // Re-insert at front of queue for retry
        queue.update(item.id, { status: 'retrying' });
      } else {
        queue.update(item.id, { status: 'failed', lastError: error, completedAt: nowMs() });
        this.metrics.recordFailed(sessionId);

        void this.bus.emit('status:failed' as never, {
          sessionId, statusId: item.id, error, attempts: item.attempts,
        } as never);

        log.error('Status permanently failed', { sessionId, id: item.id, error, attempts: item.attempts });
      }
    }
  }

  private getQueue(sessionId: string): StatusQueue {
    let q = this.queues.get(sessionId);
    if (!q) {
      q = new StatusQueue();
      this.queues.set(sessionId, q);
    }
    return q;
  }
}
