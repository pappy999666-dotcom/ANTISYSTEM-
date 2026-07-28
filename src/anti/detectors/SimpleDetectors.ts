/**
 * PAPPYBOT V2 — Simple Detectors
 *
 * Text, Emoji, Poll, Forward, Channel/Newsletter, GroupCall detectors.
 *
 * GroupCall and GroupStatusMention:
 *   @crysnovax/baileys surfaces call events via the 'call' event on the socket.
 *   Group call detection is handled at the event level in WhatsAppClient and
 *   emitted as 'call:incoming'. The detector here flags call-type messages
 *   if they appear in the message stream. Full group call interception
 *   depends on what the library exposes at runtime.
 *
 *   GroupStatusMention: not currently exposed as a distinct message type by
 *   the library. The detector is framework-ready and will match if the
 *   message type becomes available.
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

// ── Text Detector ────────────────────────────────────────────────────────────

export const TextDetector: BaseDetector = {
  id: 'text',
  async detect(message, _settings) {
    const start = Date.now();
    if (message.type === 'text') {
      return matchResult('text', Date.now() - start, { confidence: 1, reason: 'text message' });
    }
    return noMatch('text', Date.now() - start);
  },
};

// ── Emoji Detector ───────────────────────────────────────────────────────────

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

export const EmojiDetector: BaseDetector = {
  id: 'emoji',
  async detect(message, settings) {
    const start = Date.now();
    const threshold = (settings['threshold'] as number | undefined) ?? 1;
    const text = message.text ?? message.caption ?? '';
    const emojis = text.match(EMOJI_REGEX) ?? [];
    if (emojis.length >= threshold) {
      return matchResult('emoji', Date.now() - start, {
        confidence: Math.min(emojis.length / Math.max(threshold, 1), 1),
        matchedRule: threshold === 1 ? 'any_emoji' : 'emoji_flood',
        metadata: { count: emojis.length, threshold },
        reason: `${emojis.length} emoji(s) detected`,
      });
    }
    return noMatch('emoji', Date.now() - start);
  },
};

// ── Poll Detector ────────────────────────────────────────────────────────────

export const PollDetector: BaseDetector = {
  id: 'poll',
  async detect(message, _settings) {
    const start = Date.now();
    if (message.type === 'poll') {
      return matchResult('poll', Date.now() - start, {
        confidence: 1,
        metadata: { pollName: message.pollInfo?.name },
        reason: 'poll message',
      });
    }
    return noMatch('poll', Date.now() - start);
  },
};

// ── Forward Detector ─────────────────────────────────────────────────────────

export const ForwardDetector: BaseDetector = {
  id: 'forward',
  async detect(message, settings) {
    const start = Date.now();
    const minScore = (settings['minForwardingScore'] as number | undefined) ?? 1;
    const score = message.forwardingScore ?? 0;
    if (score >= minScore) {
      return matchResult('forward', Date.now() - start, {
        confidence: Math.min(score / 10, 1),
        matchedRule: 'forwarding_score',
        metadata: { forwardingScore: score },
        reason: `Forwarded message (score: ${score})`,
      });
    }
    return noMatch('forward', Date.now() - start);
  },
};

// ── Channel / Newsletter Detector ────────────────────────────────────────────

export const ChannelDetector: BaseDetector = {
  id: 'channel',
  async detect(message, _settings) {
    const start = Date.now();
    // Baileys surfaces newsletter messages with remoteJid ending in @newsletter
    // and populates newsletterInfo on the normalized message.
    if (message.newsletterInfo?.newsletterJid || message.chatJid.endsWith('@newsletter')) {
      return matchResult('channel', Date.now() - start, {
        confidence: 1,
        metadata: { newsletterJid: message.newsletterInfo?.newsletterJid },
        reason: 'Channel/newsletter message',
      });
    }
    return noMatch('channel', Date.now() - start);
  },
};

// ── Group Call Detector ───────────────────────────────────────────────────────
// NOTE: @crysnovax/baileys surfaces call events via the 'call' socket event,
// not as regular messages. The AntiEngine subscribes to 'call:incoming' on the
// EventBus (emitted by WhatsAppClient) and routes it through this detector.
// This detector matches a synthetic message type 'call' if it ever appears.

export const GroupCallDetector: BaseDetector = {
  id: 'groupcall',
  async detect(message, _settings) {
    const start = Date.now();
    // Synthetic: WhatsAppClient emits call:incoming → AntiEngine creates a
    // synthetic normalized message with type 'call' for pipeline processing.
    if ((message.type as string) === 'call') {
      return matchResult('groupcall', Date.now() - start, {
        confidence: 1,
        reason: 'Group call detected',
      });
    }
    return noMatch('groupcall', Date.now() - start);
  },
};
