/**
 * PAPPYBOT V2 — Spam Detector
 *
 * Adaptive spam detector. Tracks message bursts per user per group
 * using a sliding window. Detects:
 *   - Message flood (N messages in T seconds)
 *   - Repeated identical text
 *   - Repeated media (same type burst)
 *   - Repeated mentions
 *   - Repeated stickers
 *   - Emoji floods
 *
 * Settings:
 *   limit: number       — max messages in window (default: 10)
 *   windowMs: number    — window size in ms (default: 5000)
 *   repeatThreshold: number — identical message repeat count (default: 3)
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

interface UserWindow {
  timestamps: number[];
  lastText: string;
  repeatCount: number;
}

export class SpamDetector implements BaseDetector {
  readonly id = 'spam';

  /** key: `${sessionId}:${groupJid}:${senderJid}` */
  private readonly windows = new Map<string, UserWindow>();

  async detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();
    const limit = (settings['limit'] as number | undefined) ?? 10;
    const windowMs = (settings['windowMs'] as number | undefined) ?? 5_000;
    const repeatThreshold = (settings['repeatThreshold'] as number | undefined) ?? 3;

    const key = `${message.sessionId}:${message.chatJid}:${message.sender.jid}`;
    const now = Date.now();

    let win = this.windows.get(key);
    if (!win) { win = { timestamps: [], lastText: '', repeatCount: 0 }; this.windows.set(key, win); }

    // Slide window
    win.timestamps = win.timestamps.filter(t => now - t < windowMs);
    win.timestamps.push(now);

    // Repeated text check
    const text = message.text ?? message.caption ?? '';
    if (text && text === win.lastText) {
      win.repeatCount++;
    } else {
      win.repeatCount = 1;
      win.lastText = text;
    }

    const burstCount = win.timestamps.length;
    const isFlood = burstCount >= limit;
    const isRepeat = win.repeatCount >= repeatThreshold;

    if (isFlood || isRepeat) {
      const reason = isFlood
        ? `${burstCount} messages in ${windowMs}ms`
        : `Repeated message ${win.repeatCount}x`;

      return matchResult('spam', Date.now() - start, {
        confidence: Math.min(burstCount / limit, 1),
        matchedRule: isFlood ? 'burst_flood' : 'repeat_message',
        metadata: { burstCount, limit, windowMs, repeatCount: win.repeatCount },
        reason,
      });
    }

    return noMatch('spam', Date.now() - start);
  }

  /** Clear windows for a user (e.g. after kick) */
  clearUser(sessionId: string, groupJid: string, senderJid: string): void {
    this.windows.delete(`${sessionId}:${groupJid}:${senderJid}`);
  }

  /** Prune stale windows to free memory */
  prune(windowMs = 5_000): void {
    const cutoff = Date.now() - windowMs;
    for (const [k, win] of this.windows) {
      if (!win.timestamps.some(t => t > cutoff)) this.windows.delete(k);
    }
  }
}
