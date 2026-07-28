/**
 * PAPPYBOT V2 — Anti Config Manager
 *
 * Per-group, per-session configuration store with O(1) lookups.
 * Changing a setting in one group never affects another.
 *
 * Config is held in memory (Map) and optionally persisted to the
 * DatabaseManager in a future prompt. The cache layer ensures
 * hot-path reads are always O(1).
 */

import type { AntiGroupConfig, DetectorConfig, DetectorId, ActionType } from '../types/Anti';
import { logger } from '../../logger/Logger';

const log = logger.child('AntiConfigManager');

const DEFAULT_WARN_LIMIT = 3;

const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  enabled: false,
  action: 'delete+warn',
  settings: {},
};

export class AntiConfigManager {
  /** key: `${sessionId}:${groupJid}` → config */
  private readonly configs = new Map<string, AntiGroupConfig>();

  private key(sessionId: string, groupJid: string): string {
    return `${sessionId}:${groupJid}`;
  }

  // ── Read ────────────────────────────────────────────────────────────────

  get(sessionId: string, groupJid: string): AntiGroupConfig {
    const k = this.key(sessionId, groupJid);
    let cfg = this.configs.get(k);
    if (!cfg) {
      cfg = this.createDefault(sessionId, groupJid);
      this.configs.set(k, cfg);
    }
    return cfg;
  }

  getDetector(sessionId: string, groupJid: string, detectorId: DetectorId): DetectorConfig {
    const cfg = this.get(sessionId, groupJid);
    return cfg.detectors[detectorId] ?? { ...DEFAULT_DETECTOR_CONFIG };
  }

  isEnabled(sessionId: string, groupJid: string, detectorId: DetectorId): boolean {
    return this.getDetector(sessionId, groupJid, detectorId).enabled;
  }

  getAction(sessionId: string, groupJid: string, detectorId: DetectorId): ActionType {
    return this.getDetector(sessionId, groupJid, detectorId).action;
  }

  getSetting<T>(sessionId: string, groupJid: string, detectorId: DetectorId, key: string): T | undefined {
    return this.getDetector(sessionId, groupJid, detectorId).settings[key] as T | undefined;
  }

  getWarnLimit(sessionId: string, groupJid: string): number {
    return this.get(sessionId, groupJid).warnLimit;
  }

  getTemplate(sessionId: string, groupJid: string, key: string): string | undefined {
    return this.get(sessionId, groupJid).templates[key];
  }

  // ── Write ───────────────────────────────────────────────────────────────

  setEnabled(sessionId: string, groupJid: string, detectorId: DetectorId, enabled: boolean): void {
    const cfg = this.get(sessionId, groupJid);
    this.ensureDetector(cfg, detectorId).enabled = enabled;
    cfg.updatedAt = Date.now();
    log.debug('Detector toggled', { sessionId, groupJid, detectorId, enabled });
  }

  setAction(sessionId: string, groupJid: string, detectorId: DetectorId, action: ActionType): void {
    const cfg = this.get(sessionId, groupJid);
    this.ensureDetector(cfg, detectorId).action = action;
    cfg.updatedAt = Date.now();
  }

  setSetting(sessionId: string, groupJid: string, detectorId: DetectorId, key: string, value: unknown): void {
    const cfg = this.get(sessionId, groupJid);
    this.ensureDetector(cfg, detectorId).settings[key] = value;
    cfg.updatedAt = Date.now();
  }

  setWarnLimit(sessionId: string, groupJid: string, limit: number): void {
    const cfg = this.get(sessionId, groupJid);
    cfg.warnLimit = Math.max(1, limit);
    cfg.updatedAt = Date.now();
  }

  setTemplate(sessionId: string, groupJid: string, key: string, template: string): void {
    const cfg = this.get(sessionId, groupJid);
    cfg.templates[key] = template;
    cfg.updatedAt = Date.now();
  }

  /** Bulk-load a config (e.g. from database on startup) */
  load(config: AntiGroupConfig): void {
    this.configs.set(this.key(config.sessionId, config.groupJid), config);
  }

  /** Remove config for a group (e.g. bot left the group) */
  remove(sessionId: string, groupJid: string): void {
    this.configs.delete(this.key(sessionId, groupJid));
  }

  /** All loaded configs */
  getAll(): AntiGroupConfig[] {
    return [...this.configs.values()];
  }

  // ── Private ─────────────────────────────────────────────────────────────

  private createDefault(sessionId: string, groupJid: string): AntiGroupConfig {
    return {
      groupJid,
      sessionId,
      detectors: {},
      warnLimit: DEFAULT_WARN_LIMIT,
      templates: {},
      updatedAt: Date.now(),
    };
  }

  private ensureDetector(cfg: AntiGroupConfig, detectorId: DetectorId): DetectorConfig {
    if (!cfg.detectors[detectorId]) {
      cfg.detectors[detectorId] = { ...DEFAULT_DETECTOR_CONFIG };
    }
    return cfg.detectors[detectorId]!;
  }
}
