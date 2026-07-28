/**
 * PAPPYBOT V2 — Detector Engine
 *
 * Plugin-based detector framework. Each detector is an independent module
 * that implements BaseDetector. The engine runs all enabled detectors
 * against a message and returns their results.
 *
 * Detectors are stateless — per-group config is passed at runtime.
 * Extension point: DetectorEngine.register(new MyDetector()).
 */

import type { DetectionResult, DetectorId, AntiGroupConfig } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { logger } from '../../logger/Logger';

const log = logger.child('DetectorEngine');

export interface BaseDetector {
  readonly id: DetectorId;
  detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult>;
}

export class DetectorEngine {
  private readonly detectors = new Map<DetectorId, BaseDetector>();

  register(detector: BaseDetector): void {
    this.detectors.set(detector.id, detector);
    log.debug('Detector registered', { id: detector.id });
  }

  unregister(id: DetectorId): void { this.detectors.delete(id); }
  has(id: DetectorId): boolean { return this.detectors.has(id); }
  getIds(): DetectorId[] { return [...this.detectors.keys()]; }

  /** Run all enabled detectors in parallel */
  async runAll(
    message: ExtendedNormalizedMessage,
    groupConfig: AntiGroupConfig
  ): Promise<DetectionResult[]> {
    const tasks: Promise<DetectionResult>[] = [];
    for (const [id, detector] of this.detectors) {
      const cfg = groupConfig.detectors[id];
      if (!cfg?.enabled) continue;
      tasks.push(this.runSafe(detector, message, cfg.settings));
    }
    return Promise.all(tasks);
  }

  async run(
    id: DetectorId,
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult | undefined> {
    const d = this.detectors.get(id);
    if (!d) return undefined;
    return this.runSafe(d, message, settings);
  }

  private async runSafe(
    detector: BaseDetector,
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();
    try {
      return await detector.detect(message, settings);
    } catch (err) {
      log.warn('Detector threw', { id: detector.id, error: String(err) });
      return { detectorId: detector.id, matched: false, confidence: 0, metadata: { error: String(err) }, executionMs: Date.now() - start };
    }
  }
}

export function noMatch(detectorId: DetectorId, executionMs: number): DetectionResult {
  return { detectorId, matched: false, confidence: 0, metadata: {}, executionMs };
}

export function matchResult(
  detectorId: DetectorId,
  executionMs: number,
  opts: { confidence?: number; matchedRule?: string; metadata?: Record<string, unknown>; reason?: string }
): DetectionResult {
  return {
    detectorId, matched: true,
    confidence: opts.confidence ?? 1,
    matchedRule: opts.matchedRule,
    metadata: opts.metadata ?? {},
    executionMs,
    reason: opts.reason,
  };
}
