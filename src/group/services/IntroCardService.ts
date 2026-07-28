/**
 * PAPPYBOT V2 — Intro Card Service (Placeholder)
 *
 * Placeholder for the future Intro Card URL button system.
 * The Welcome system calls this service to attach an intro URL button
 * when the web dashboard is implemented in a later prompt.
 *
 * Extension point: implement generateIntroUrl() in the Web Dashboard prompt.
 */

import { logger } from '../../logger/Logger';

const log = logger.child('IntroCardService');

export interface IntroCard {
  url: string;
  title: string;
  description?: string;
}

export class IntroCardService {
  private readonly cards = new Map<string, IntroCard>();

  /** Register an intro card for a group (called by web dashboard later) */
  setCard(sessionId: string, groupJid: string, card: IntroCard): void {
    this.cards.set(`${sessionId}:${groupJid}`, card);
    log.debug('Intro card set', { groupJid });
  }

  /** Get the intro card for a group, if configured */
  getCard(sessionId: string, groupJid: string): IntroCard | undefined {
    return this.cards.get(`${sessionId}:${groupJid}`);
  }

  removeCard(sessionId: string, groupJid: string): void {
    this.cards.delete(`${sessionId}:${groupJid}`);
  }

  /**
   * Build a Baileys-compatible URL button payload for the intro card.
   * Returns undefined if no card is configured for this group.
   * Future: attach to welcome message as a supported URL button.
   */
  buildButtonPayload(sessionId: string, groupJid: string): Record<string, unknown> | undefined {
    const card = this.getCard(sessionId, groupJid);
    if (!card) return undefined;
    // Placeholder — actual button format depends on library support at runtime
    return {
      urlButton: {
        displayText: card.title,
        url: card.url,
      },
    };
  }
}
