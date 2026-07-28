/**
 * .setaiprefix <prefix> — Set the AI trigger prefix for the session.
 * Requires: SESSION_OWNER
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';

export class SetAiPrefixCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setaiprefix',
    description: 'Set the word that triggers the AI assistant',
    usage: '.setaiprefix <word>',
    examples: ['.setaiprefix pappy', '.setaiprefix bot'],
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(private readonly configService: AIConfigService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1)) return;
    const prefix = ctx.args.argv[0].toLowerCase();
    await this.configService.setPrefix(ctx.session.config.id, prefix);
    await this.replySuccess(ctx, `AI prefix set to \`${prefix}\`. Say \`${prefix} <your request>\` to activate.`);
  }
}
