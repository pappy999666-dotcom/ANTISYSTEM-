/**
 * PAPPYBOT V2 — Rule Engine
 *
 * Evaluates DetectionResults against the group's AntiRules and
 * returns the first matching rule for each result.
 *
 * Rules are derived from the group's AntiGroupConfig — no separate
 * rule store is needed. The engine is stateless.
 */

import type { DetectionResult, AntiRule, AntiGroupConfig, ActionType } from '../types/Anti';

export class RuleEngine {
  /**
   * Given a detection result and the group config, return the matching
   * AntiRule if the result should trigger an action, or undefined if not.
   */
  evaluate(result: DetectionResult, groupConfig: AntiGroupConfig): AntiRule | undefined {
    if (!result.matched) return undefined;

    const detectorCfg = groupConfig.detectors[result.detectorId];
    if (!detectorCfg?.enabled) return undefined;

    const minConfidence = (detectorCfg.settings['minConfidence'] as number | undefined) ?? 0.5;
    if (result.confidence < minConfidence) return undefined;

    return {
      detectorId: result.detectorId,
      action: detectorCfg.action,
      minConfidence,
      enabled: true,
      templateKey: detectorCfg.settings['templateKey'] as string | undefined,
    };
  }

  /**
   * Evaluate all results and return matched rules.
   * Returns an array of [result, rule] pairs.
   */
  evaluateAll(
    results: DetectionResult[],
    groupConfig: AntiGroupConfig
  ): Array<{ result: DetectionResult; rule: AntiRule }> {
    const matched: Array<{ result: DetectionResult; rule: AntiRule }> = [];
    for (const result of results) {
      const rule = this.evaluate(result, groupConfig);
      if (rule) matched.push({ result, rule });
    }
    return matched;
  }

  /** Build a default rule from an action type */
  static defaultRule(detectorId: string, action: ActionType): AntiRule {
    return { detectorId, action, minConfidence: 0.5, enabled: true };
  }
}
