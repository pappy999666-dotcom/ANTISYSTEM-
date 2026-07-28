/**
 * .setaitoken <key> — Set the AI API key for the session.
 * Requires: SESSION_OWNER (private chat only for security)
 */

import { R } from '../../ui/ResponseFormatter';
import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';

export class SetAiTokenCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setaitoken',
    description: 'Set the API key for the AI provider (use in private chat)',
    usage: '.setaitoken <api-key>',
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
    hidden: true,  // Hide from help to avoid exposure
  };

  constructor(private readonly configService: AIConfigService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1)) return;

    // Security: warn if used in a group
    if (ctx.message.chatType === 'group') {
      await ctx.reply(R.warning('*Security warning:* Use this command in a *private chat* to avoid exposing your API key.'));
      return;
    }

    const apiKey = ctx.args.raw.trim();
    await this.configService.setApiKey(ctx.session.config.id, apiKey);
    await this.replySuccess(ctx, 'AI API key saved. ✅\n\nEnable the assistant with `.ai on`');
  }
}
