/**
 * PAPPYBOT V2 — Status Metrics Manager
 */

import type { StatusMetrics, StatusContentType } from '../types/GStatus';

export class StatusMetricsManager {
  private readonly metrics = new Map<string, StatusMetrics>();

  private get(sessionId: string): StatusMetrics {
    let m = this.metrics.get(sessionId);
    if (!m) {
      m = {
        sessionId,
        totalSent: 0,
        totalFailed: 0,
        totalRetries: 0,
        queueLength: 0,
        avgSendTimeMs: 0,
        byContentType: {
          text: 0, image: 0, video: 0, audio: 0,
          sticker: 0, document: 0, gif: 0,
        },
        previewsReused: 0,
        previewsGenerated: 0,
        lastUpdated: Date.now(),
      };
      this.metrics.set(sessionId, m);
    }
    return m;
  }

  recordSent(sessionId: string, contentType: StatusContentType, durationMs: number): void {
    const m = this.get(sessionId);
    m.totalSent++;
    m.byContentType[contentType]++;
    // Rolling average
    m.avgSendTimeMs = m.totalSent === 1
      ? durationMs
      : Math.round((m.avgSendTimeMs * (m.totalSent - 1) + durationMs) / m.totalSent);
    m.lastUpdated = Date.now();
  }

  recordFailed(sessionId: string): void {
    const m = this.get(sessionId);
    m.totalFailed++;
    m.lastUpdated = Date.now();
  }

  recordRetry(sessionId: string): void {
    const m = this.get(sessionId);
    m.totalRetries++;
    m.lastUpdated = Date.now();
  }

  recordPreviewReused(sessionId: string): void {
    this.get(sessionId).previewsReused++;
  }

  recordPreviewGenerated(sessionId: string): void {
    this.get(sessionId).previewsGenerated++;
  }

  setQueueLength(sessionId: string, length: number): void {
    this.get(sessionId).queueLength = length;
  }

  snapshot(sessionId: string): StatusMetrics {
    return { ...this.get(sessionId) };
  }

  all(): StatusMetrics[] {
    return [...this.metrics.values()].map(m => ({ ...m }));
  }
}
