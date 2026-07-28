/**
 * PAPPYBOT V2 — Base Command
 *
 * All bot commands extend this class.
 * Commands validate input, call services, and reply via ResponseFormatter.
 * Business logic lives in services — never here.
 */

import type { CommandMeta, CommandContext, CommandHandler } from '../types/Command';
import { R } from '../ui/ResponseFormatter';
import { logger } from '../logger/Logger';

export abstract class BaseCommand implements CommandHandler {
  protected readonly log = logger.child(this.constructor.name);

  abstract readonly meta: CommandMeta;
  abstract execute(ctx: CommandContext): Promise<void>;

  /** Validate minimum argument count. Sends formatted error and returns false if not met. */
  protected requireArgs(ctx: CommandContext, min: number, usage?: string): boolean {
    if (ctx.args.argv.length < min) {
      const hint = usage ?? this.meta.usage ?? `${this.meta.name} <args>`;
      void ctx.reply(R.error(`Usage: *${hint}*`, 'INVALID USAGE'));
      return false;
    }
    return true;
  }

  /** Send a formatted error reply. */
  protected async replyError(ctx: CommandContext, message: string): Promise<void> {
    await ctx.reply(R.error(message));
  }

  /** Send a formatted success reply. */
  protected async replySuccess(ctx: CommandContext, message: string): Promise<void> {
    await ctx.reply(R.success(message));
  }

  /** Send a formatted warning reply. */
  protected async replyWarning(ctx: CommandContext, message: string): Promise<void> {
    await ctx.reply(R.warning(message));
  }

  /** Send a formatted loading reply. Returns the message ID for later editing. */
  protected async replyLoading(ctx: CommandContext, label: string): Promise<string | undefined> {
    return ctx.replyGetId?.(R.loading(label));
  }

  /** Edit a previously sent message (live update). Falls back to new reply if unsupported. */
  protected async editOrReply(ctx: CommandContext, msgId: string | undefined, text: string): Promise<void> {
    if (msgId && ctx.editMessage) {
      await ctx.editMessage(msgId, text);
    } else {
      await ctx.reply(text);
    }
  }
}
