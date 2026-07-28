/**
 * PAPPYBOT V2 — Bridge Context
 *
 * Tracks the active workspace for each Telegram user in bridge mode.
 * Every command executed via the bridge uses this context to know:
 *   - Which WhatsApp session to use
 *   - Which WhatsApp group to target
 *   - Who the owner is
 *   - Who the current Telegram user is
 *
 * No command may execute in the wrong group.
 */

export interface BridgeContext {
  telegramId: number;
  sessionId: string;
  groupJid: string;
  groupName: string;
  ownerJid: string;
  activatedAt: number;
}

class BridgeContextStore {
  private readonly contexts = new Map<number, BridgeContext>();

  set(ctx: BridgeContext): void {
    this.contexts.set(ctx.telegramId, ctx);
  }

  get(telegramId: number): BridgeContext | undefined {
    return this.contexts.get(telegramId);
  }

  clear(telegramId: number): void {
    this.contexts.delete(telegramId);
  }

  has(telegramId: number): boolean {
    return this.contexts.has(telegramId);
  }
}

export const bridgeContextStore = new BridgeContextStore();
