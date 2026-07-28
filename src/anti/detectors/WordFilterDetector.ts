/**
 * PAPPYBOT V2 — Word Filter Detector (AntiWords)
 *
 * Per-group word filter with exact, contains, whole-word, and regex matching.
 * Word lists are stored in settings and can be imported/exported.
 *
 * Settings:
 *   words: string[]          — list of banned words/phrases
 *   mode: 'exact'|'contains'|'word'|'regex'  (default: 'contains')
 *   caseSensitive: boolean   (default: false)
 *   categories: Record<string, string[]>  — named word categories
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

type MatchMode = 'exact' | 'contains' | 'word' | 'regex';

export class WordFilterDetector implements BaseDetector {
  readonly id = 'words';

  async detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();

    const words = (settings['words'] as string[] | undefined) ?? [];
    const categories = (settings['categories'] as Record<string, string[]> | undefined) ?? {};
    const mode = (settings['mode'] as MatchMode | undefined) ?? 'contains';
    const caseSensitive = (settings['caseSensitive'] as boolean | undefined) ?? false;

    // Flatten all word lists
    const allWords = [...words, ...Object.values(categories).flat()];
    if (!allWords.length) return noMatch('words', Date.now() - start);

    const surfaces = [
      message.text,
      message.caption,
      message.quoted?.text,
      message.pollInfo?.name,
    ].filter((s): s is string => !!s);

    for (const surface of surfaces) {
      // Normalize zero-width / invisible chars before matching (prevents evasion)
      const normalized = this.stripInvisible(surface);
      const matched = this.findMatch(normalized, allWords, mode, caseSensitive);
      if (matched) {
        return matchResult('words', Date.now() - start, {
          confidence: 1,
          matchedRule: mode,
          metadata: { matchedWord: matched, surface: normalized.slice(0, 100) },
          reason: `Prohibited word: "${matched}"`,
        });
      }
    }

    return noMatch('words', Date.now() - start);
  }

  /** Strip zero-width and invisible characters to prevent filter evasion. */
  private stripInvisible(text: string): string {
    // eslint-disable-next-line no-control-regex
    return text.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u180E]/g, '');
  }

  private findMatch(text: string, words: string[], mode: MatchMode, caseSensitive: boolean): string | null {
    const haystack = caseSensitive ? text : text.toLowerCase();

    for (const word of words) {
      const needle = caseSensitive ? word : word.toLowerCase();
      let hit = false;

      switch (mode) {
        case 'exact':
          hit = haystack === needle;
          break;
        case 'contains':
          hit = haystack.includes(needle);
          break;
        case 'word':
          hit = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(haystack);
          break;
        case 'regex':
          try {
            hit = new RegExp(word, caseSensitive ? '' : 'i').test(text);
          } catch { hit = false; }
          break;
      }

      if (hit) return word;
    }
    return null;
  }
}
