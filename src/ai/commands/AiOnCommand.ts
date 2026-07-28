/**
 * .ai on — Enable AI assistant for the current session.
 * Requires: SESSION_OWNER or SUDO
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';

import { R } from '../../ui/ResponseFormatter';

export class AiOnCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'ai',
    aliases: ['ai on'],
    description: 'Enable or disable the AI assistant',
    usage: '.ai on | .ai off',
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(private readonly configService: AIConfigService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.args.argv[0]?.toLowerCase();

    if (!sub || sub === 'on') {
      const settings = await this.configService.getSettings(ctx.session.config.id);
      if (!settings.apiKey) {
        await ctx.reply(R.warning('Set your API key first:\n`.setaitoken <your-api-key>`'));
        return;
      }
      await this.configService.enable(ctx.session.config.id);
      await this.replySuccess(ctx, 'AI assistant enabled. Say `pappy <your request>` to interact.');
    } else if (sub === 'off') {
      await this.configService.disable(ctx.session.config.id);
      await this.replySuccess(ctx, 'AI assistant disabled.');
    } else {
      await ctx.reply(R.error('Usage: `.ai on` or `.ai off`', 'INVALID USAGE'));
    }
  }
}
