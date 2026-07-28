/**
 * PAPPYBOT V2 — Status Queue
 *
 * Priority queue for status send operations.
 * Prevents duplicate sends, race conditions, and parallel conflicts.
 * One queue per session — enforced by StatusEngine.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StatusQueueItem, StatusContentType } from '../types/GStatus';
import { logger } from '../../logger/Logger';

const log = logger.child('StatusQueue');

export class StatusQueue {
  private readonly items = new Map<string, StatusQueueItem>();
  /** Ordered list of IDs by priority (highest first) */
  private order: string[] = [];

  enqueue(
    sessionId: string,
    contentType: StatusContentType,
    opts: Partial<Omit<StatusQueueItem, 'id' | 'sessionId' | 'contentType' | 'status' | 'attempts' | 'queuedAt'>> = {}
  ): StatusQueueItem {
    const item: StatusQueueItem = {
      id: uuidv4(),
      sessionId,
      contentType,
      priority: opts.priority ?? 0,
      status: 'queued',
      attempts: 0,
      maxRetries: opts.maxRetries ?? 3,
      queuedAt: Date.now(),
      text: opts.text,
      mediaBuffer: opts.mediaBuffer,
      mediaUrl: opts.mediaUrl,
      mimeType: opts.mimeType,
      fileName: opts.fileName,
      mentions: opts.mentions,
      existingPreview: opts.existingPreview,
      generatePreview: opts.generatePreview,
      backgroundColor: opts.backgroundColor,
      font: opts.font,
    };

    this.items.set(item.id, item);
    this.insertSorted(item.id, item.priority);
    log.debug('Status queued', { id: item.id, sessionId, contentType, priority: item.priority });
    return item;
  }

  /** Get the next item ready to process (queued or retrying) */
  next(): StatusQueueItem | undefined {
    for (const id of this.order) {
      const item = this.items.get(id);
      if (item && (item.status === 'queued' || item.status === 'retrying')) {
        return item;
      }
    }
    return undefined;
  }

  get(id: string): StatusQueueItem | undefined {
    return this.items.get(id);
  }

  update(id: string, patch: Partial<StatusQueueItem>): void {
    const item = this.items.get(id);
    if (!item) return;
    Object.assign(item, patch);
  }

  cancel(id: string): boolean {
    const item = this.items.get(id);
    if (!item || item.status === 'completed' || item.status === 'failed') return false;
    item.status = 'cancelled';
    log.debug('Status cancelled', { id });
    return true;
  }

  remove(id: string): void {
    this.items.delete(id);
    this.order = this.order.filter(i => i !== id);
  }

  /** Remove completed/failed/cancelled items older than maxAgeMs */
  prune(maxAgeMs = 5 * 60_000): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [id, item] of this.items) {
      if (
        ['completed', 'failed', 'cancelled'].includes(item.status) &&
        (item.completedAt ?? item.queuedAt) < cutoff
      ) {
        this.remove(id);
        removed++;
      }
    }
    return removed;
  }

  length(): number {
    return [...this.items.values()].filter(i => i.status === 'queued' || i.status === 'retrying').length;
  }

  all(): StatusQueueItem[] {
    return [...this.items.values()];
  }

  private insertSorted(id: string, priority: number): void {
    // Insert in descending priority order
    let idx = this.order.length;
    for (let i = 0; i < this.order.length; i++) {
      const existing = this.items.get(this.order[i]!);
      if (existing && existing.priority < priority) {
        idx = i;
        break;
      }
    }
    this.order.splice(idx, 0, id);
  }
}
