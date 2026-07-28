/**
 * PAPPYBOT V2 — Link Detector
 *
 * Detects URLs and invite links across all message surfaces exposed
 * by the normalized message: text, captions, quoted text, poll names,
 * document/image/video captions, link preview metadata.
 *
 * Normalizes text before checking:
 *   - Removes zero-width characters
 *   - Normalizes whitespace
 *   - Handles hxxp/hxxps obfuscation
 *   - Handles dot-substitution obfuscation (e.g. "example[.]com")
 *
 * Settings (DetectorConfig.settings):
 *   allowedDomains: string[]   — trusted domains to skip
 *   allowInvites: boolean      — allow chat.whatsapp.com links
 *   checkQuoted: boolean       — also scan quoted message text (default: true)
 *   checkCaption: boolean      — scan captions (default: true)
 *   checkLinkPreview: boolean  — scan link preview metadata (default: true)
 */

import type { BaseDetector } from '../core/DetectorEngine';
import type { DetectionResult } from '../types/Anti';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import { noMatch, matchResult } from '../core/DetectorEngine';

// Comprehensive URL pattern — matches with or without protocol
const URL_REGEX = /(?:https?:\/\/|ftp:\/\/|www\.|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|co|app|dev|xyz|me|info|biz|gg|tv|ly|link|site|online|store|shop|club|live|news|tech|ai|bot|chat|group|vip|pro|top|win|fun|click|download|stream|watch|play|game|bet|casino|adult|xxx|porn|sex|nude|onlyfans|telegram|discord|tiktok|instagram|facebook|youtube|twitter|x\.com|wa\.me|t\.me|bit\.ly|tinyurl|shorturl|rb\.gy|cutt\.ly|is\.gd|v\.gd|ow\.ly|buff\.ly|adf\.ly|linktr\.ee)(?:\/[^\s]*)?)/gi;

const WHATSAPP_INVITE = /chat\.whatsapp\.com\/[a-zA-Z0-9]{10,}/i;

// Obfuscation patterns
const HXXP = /hxxps?/gi;
const DOT_OBFUSCATION = /\[\.?\]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u00AD]/g;

export class LinkDetector implements BaseDetector {
  readonly id = 'link';

  async detect(
    message: ExtendedNormalizedMessage,
    settings: Record<string, unknown>
  ): Promise<DetectionResult> {
    const start = Date.now();

    const allowedDomains = (settings['allowedDomains'] as string[] | undefined) ?? [];
    const allowInvites = (settings['allowInvites'] as boolean | undefined) ?? false;
    const checkQuoted = (settings['checkQuoted'] as boolean | undefined) ?? true;
    const checkCaption = (settings['checkCaption'] as boolean | undefined) ?? true;
    const checkLinkPreview = (settings['checkLinkPreview'] as boolean | undefined) ?? true;

    // Collect all text surfaces
    const surfaces: string[] = [];
    if (message.text) surfaces.push(message.text);
    if (checkCaption && message.caption) surfaces.push(message.caption);
    if (checkQuoted && message.quoted?.text) surfaces.push(message.quoted.text);
    if (checkLinkPreview && message.linkPreview?.url) surfaces.push(message.linkPreview.url);
    if (checkLinkPreview && message.linkPreview?.title) surfaces.push(message.linkPreview.title);
    if (message.pollInfo?.name) surfaces.push(message.pollInfo.name);

    for (const raw of surfaces) {
      const normalized = this.normalize(raw);
      const urls = this.extractUrls(normalized);
      if (!urls.length) continue;

      const filtered = urls.filter(url => {
        if (allowInvites && WHATSAPP_INVITE.test(url)) return false;
        return !allowedDomains.some(d => url.toLowerCase().includes(d.toLowerCase()));
      });

      if (filtered.length > 0) {
        return matchResult('link', Date.now() - start, {
          confidence: 1,
          matchedRule: 'url_found',
          metadata: { urls: filtered },
          reason: `Link detected: ${filtered[0]}`,
        });
      }
    }

    return noMatch('link', Date.now() - start);
  }

  private normalize(text: string): string {
    return text
      .replace(ZERO_WIDTH, '')
      .replace(HXXP, 'http')
      .replace(DOT_OBFUSCATION, '.')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractUrls(text: string): string[] {
    URL_REGEX.lastIndex = 0;
    const found: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = URL_REGEX.exec(text)) !== null) {
      found.push(m[0]);
    }
    return found;
  }
}
