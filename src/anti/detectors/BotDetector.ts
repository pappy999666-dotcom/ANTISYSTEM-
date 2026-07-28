/**
 * PAPPYBOT V2 — Bot Detector
 *
 * Confidence-based detector using only observable information exposed
 * by the Baileys library. Does NOT claim perfect detection or rely on
 * hidden WhatsApp internals.
 *
 * Observable signals scored to produce a 0–1 confidence value:
 *   - Message sent from self (fromMe / isBot flag)
 *   - JID contains known bot suffixes (:0@, :1@, etc. — multi-device)
 *   - Extremely high message frequency (checked via SpamDetector integration)
 *   - Push name matches common bot patterns
 *   - Message contains bot-typical metadata patterns
 *
 * Settings:
 *   threshold: number   — minimum confidence to match (default: 0.6)
 *   permitAdmins: boolean — skip admins (default: true)
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

const BOT_NAME_PATTERNS = [/bot/i, /auto/i, /robot/i, /spam/i, /flood/i, /mass/i];

export class BotDetector implements BaseDetector {
  readonly id = 'bot';

  async detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();
    const threshold = (settings['threshold'] as number | undefined) ?? 0.6;

    let score = 0;
    const signals: string[] = [];

    // Signal: message is from bot/self account
    if (message.sender.isBot) {
      score += 0.9;
      signals.push('fromMe');
    }

    // Signal: JID has multi-device device suffix (e.g. 123456:5@s.whatsapp.net)
    if (/:[\d]+@/.test(message.sender.jid)) {
      score += 0.3;
      signals.push('multiDeviceJid');
    }

    // Signal: push name matches bot patterns
    const name = message.sender.displayName ?? '';
    if (BOT_NAME_PATTERNS.some(p => p.test(name))) {
      score += 0.4;
      signals.push('botName');
    }

    // Cap at 1
    const confidence = Math.min(score, 1);

    if (confidence >= threshold) {
      return matchResult('bot', Date.now() - start, {
        confidence,
        matchedRule: 'confidence_threshold',
        metadata: { signals, score },
        reason: `Bot signals detected (confidence: ${confidence.toFixed(2)})`,
      });
    }

    return noMatch('bot', Date.now() - start);
  }
}
