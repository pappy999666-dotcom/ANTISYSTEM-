/**
 * PAPPYBOT V2 — Media Detectors
 *
 * Independent detectors for each media type.
 * Each is a separate class so they can be enabled/disabled independently.
 *
 * Detectors: picture, video, audio, voice, sticker
 * Future-ready: document (framework in place, disabled by default)
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

function makeMediaDetector(id: string, messageType: string): BaseDetector {
  return {
    id,
    async detect(message: ExtendedNormalizedMessage, _settings: Record<string, unknown>): Promise<DetectionResult> {
      const start = Date.now();
      if (message.type === messageType) {
        return matchResult(id, Date.now() - start, {
          confidence: 1,
          matchedRule: `type_${messageType}`,
          metadata: { mimeType: message.mediaInfo?.mimeType },
          reason: `${messageType} message detected`,
        });
      }
      return noMatch(id, Date.now() - start);
    },
  };
}

export const PictureDetector: BaseDetector = makeMediaDetector('picture', 'image');
export const VideoDetector: BaseDetector = makeMediaDetector('video', 'video');
export const AudioDetector: BaseDetector = makeMediaDetector('audio', 'audio');
export const VoiceDetector: BaseDetector = makeMediaDetector('voice', 'voice');
export const StickerDetector: BaseDetector = makeMediaDetector('sticker', 'sticker');

/** Document detector — future-ready, disabled by default in config */
export const DocumentDetector: BaseDetector = makeMediaDetector('document', 'document');
