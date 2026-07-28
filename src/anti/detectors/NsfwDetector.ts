/**
 * PAPPYBOT V2 — NSFW Detector
 *
 * Integrates an external NSFW scanning API through an abstract provider
 * interface. Supports image scanning with an interface extensible to video.
 *
 * Features:
 *   - Provider abstraction (swap API without touching detector)
 *   - Configurable confidence threshold
 *   - Result caching (keyed by media hash)
 *   - Timeouts and retry logic
 *   - Rate limiting
 *
 * Settings:
 *   provider: string         — provider id (default: 'sightengine')
 *   apiKey: string           — API key
 *   apiSecret: string        — API secret (if required)
 *   threshold: number        — 0–1 confidence to trigger (default: 0.7)
 *   timeout: number          — request timeout ms (default: 5000)
 *   maxRetries: number       — retry attempts (default: 2)
 *   rateLimit: number        — max requests per minute (default: 60)
 *   cacheResults: boolean    — cache scan results (default: true)
 *   cacheTtlMs: number       — cache TTL ms (default: 300000)
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';
import { logger } from '../../logger/Logger';

const log = logger.child('NsfwDetector');

// ── Provider Interface ────────────────────────────────────────────────────────

export interface NsfwScanResult {
  isNsfw: boolean;
  confidence: number;
  categories: string[];
  raw?: unknown;
}

export interface NsfwProvider {
  readonly id: string;
  scan(imageBuffer: Buffer, apiKey: string, apiSecret?: string, timeoutMs?: number): Promise<NsfwScanResult>;
}

// ── Provider Registry ─────────────────────────────────────────────────────────

const providers = new Map<string, NsfwProvider>();

export function registerNsfwProvider(provider: NsfwProvider): void {
  providers.set(provider.id, provider);
  log.debug('NSFW provider registered', { id: provider.id });
}

// ── Rate Limiter ──────────────────────────────────────────────────────────────

class RateLimiter {
  private timestamps: number[] = [];
  constructor(private readonly maxPerMinute: number) {}

  canProceed(): boolean {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 60_000);
    if (this.timestamps.length >= this.maxPerMinute) return false;
    this.timestamps.push(now);
    return true;
  }
}

// ── Detector ──────────────────────────────────────────────────────────────────

export class NsfwDetector implements BaseDetector {
  readonly id = 'nsfw';

  /** key: sha256-like hash → NsfwScanResult */
  private readonly cache = new Map<string, { result: NsfwScanResult; expiresAt: number }>();
  private readonly rateLimiters = new Map<string, RateLimiter>();

  async detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();

    // Only scan image messages (video future-ready via same interface)
    if (message.type !== 'image') return noMatch('nsfw', Date.now() - start);

    const providerId = (settings['provider'] as string | undefined) ?? 'sightengine';
    const apiKey = (settings['apiKey'] as string | undefined) ?? '';
    const apiSecret = settings['apiSecret'] as string | undefined;
    const threshold = (settings['threshold'] as number | undefined) ?? 0.7;
    const timeoutMs = (settings['timeout'] as number | undefined) ?? 5_000;
    const maxRetries = (settings['maxRetries'] as number | undefined) ?? 2;
    const rateLimit = (settings['rateLimit'] as number | undefined) ?? 60;
    const cacheResults = (settings['cacheResults'] as boolean | undefined) ?? true;
    const cacheTtlMs = (settings['cacheTtlMs'] as number | undefined) ?? 300_000;

    if (!apiKey) {
      log.warn('NSFW detector: no API key configured');
      return noMatch('nsfw', Date.now() - start);
    }

    const provider = providers.get(providerId);
    if (!provider) {
      log.warn('NSFW provider not registered', { providerId });
      return noMatch('nsfw', Date.now() - start);
    }

    // Rate limit check
    let limiter = this.rateLimiters.get(providerId);
    if (!limiter) { limiter = new RateLimiter(rateLimit); this.rateLimiters.set(providerId, limiter); }
    if (!limiter.canProceed()) {
      log.warn('NSFW rate limit reached', { providerId });
      return noMatch('nsfw', Date.now() - start);
    }

    // We need the media buffer — the raw message must be downloaded first.
    // The AntiEngine is responsible for downloading media before calling detect().
    // If no buffer is available in metadata, skip.
    const buffer = (message as unknown as Record<string, unknown>)['_mediaBuffer'] as Buffer | undefined;
    if (!buffer) return noMatch('nsfw', Date.now() - start);

    // Cache key: simple hash of first 256 bytes
    const cacheKey = cacheResults ? this.hashBuffer(buffer) : '';
    if (cacheResults && cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return this.buildResult(cached.result, threshold, Date.now() - start);
      }
    }

    // Scan with retries
    let scanResult: NsfwScanResult | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        scanResult = await provider.scan(buffer, apiKey, apiSecret, timeoutMs);
        break;
      } catch (err) {
        if (attempt === maxRetries) {
          log.warn('NSFW scan failed after retries', { error: String(err) });
          return noMatch('nsfw', Date.now() - start);
        }
      }
    }

    if (!scanResult) return noMatch('nsfw', Date.now() - start);

    if (cacheResults && cacheKey) {
      this.cache.set(cacheKey, { result: scanResult, expiresAt: Date.now() + cacheTtlMs });
    }

    return this.buildResult(scanResult, threshold, Date.now() - start);
  }

  private buildResult(result: NsfwScanResult, threshold: number, executionMs: number): DetectionResult {
    if (result.isNsfw && result.confidence >= threshold) {
      return matchResult('nsfw', executionMs, {
        confidence: result.confidence,
        matchedRule: 'nsfw_content',
        metadata: { categories: result.categories },
        reason: `NSFW content detected (confidence: ${result.confidence.toFixed(2)})`,
      });
    }
    return noMatch('nsfw', executionMs);
  }

  private hashBuffer(buf: Buffer): string {
    let hash = 0;
    const slice = buf.slice(0, 256);
    for (let i = 0; i < slice.length; i++) {
      hash = ((hash << 5) - hash + slice[i]!) | 0;
    }
    return String(hash >>> 0);
  }
}
