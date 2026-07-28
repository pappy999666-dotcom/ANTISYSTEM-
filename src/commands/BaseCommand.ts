/**
 * PAPPYBOT V2 — Base Command
 *
 * All bot commands must extend this class. Commands should only:
 *   1. Validate input
 *   2. Call services
 *   3. Return responses
 * Business logic must live in services, not here.
 */

import type { CommandMeta, CommandContext, CommandHandler } from '../types/Command';
import { logger } from '../logger/Logger';

export abstract class BaseCommand implements CommandHandler {
  protected readonly log = logger.child(this.constructor.name);

  abstract readonly meta: CommandMeta;

  abstract execute(ctx: CommandContext): Promise<void>;

  /**
   * Validate that the required number of arguments were provided.
   * Call this at the start of execute() if args are required.
   */
  protected requireArgs(ctx: CommandContext, min: number, usage?: string): boolean {
    if (ctx.args.argv.length < min) {
      const hint = usage ?? this.meta.usage ?? `Usage: ${this.meta.name} <args>`;
      ctx.reply(`⚠️ ${hint}`).catch(() => void 0);
      return false;
    }
    return true;
  }

  /**
   * Convenience: send an error reply formatted consistently.
   */
  protected async replyError(ctx: CommandContext, message: string): Promise<void> {
    await ctx.reply(`❌ ${message}`);
  }

  /**
   * Convenience: send a success reply.
   */
  protected async replySuccess(ctx: CommandContext, message: string): Promise<void> {
    await ctx.reply(`✅ ${message}`);
  }
}
