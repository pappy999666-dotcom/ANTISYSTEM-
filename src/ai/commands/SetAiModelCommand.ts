/**
 * .setaimodel <model> — Set the AI model for the session.
 * Requires: SESSION_OWNER
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';

export class SetAiModelCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setaimodel',
    description: 'Set the AI model to use',
    usage: '.setaimodel <model-name>',
    examples: ['.setaimodel gpt-4o', '.setaimodel llama-3.1-70b-versatile'],
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(private readonly configService: AIConfigService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1)) return;
    const model = ctx.args.raw.trim();
    const settings = await this.configService.setModel(ctx.session.config.id, model);
    await this.replySuccess(ctx, `AI model set to \`${settings.model}\``);
  }
}
