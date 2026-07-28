/**
 * .setaiprovider <name> — Switch AI provider for the session.
 * Requires: SESSION_OWNER
 */

import { R } from '../../ui/ResponseFormatter';
import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';
import { listProviders } from '../providers/ProviderFactory';

export class SetAiProviderCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setaiprovider',
    description: 'Set the AI provider (openai, groq, gemini, anthropic, openrouter)',
    usage: '.setaiprovider <provider>',
    examples: ['.setaiprovider groq', '.setaiprovider gemini'],
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(private readonly configService: AIConfigService) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1)) return;
    const provider = ctx.args.argv[0].toLowerCase();
    try {
      const settings = await this.configService.setProvider(ctx.session.config.id, provider);
      await this.replySuccess(ctx, `AI provider set to *${settings.provider}*.\nNow set the API key: \`.setaitoken <key>\``);
    } catch (err) {
      await this.replyError(ctx, (err as Error).message);
    }
  }
}
