/**
 * .aiinfo — Display current AI settings for the session.
 * Requires: SESSION_OWNER
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';
import type { AIMemoryService } from '../services/AIMemoryService';
import type { AIAutomationService } from '../services/AIAutomationService';

import { R } from '../../ui/ResponseFormatter';

export class AiInfoCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'aiinfo',
    description: 'Show AI assistant status and configuration',
    usage: '.aiinfo',
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(
    private readonly configService: AIConfigService,
    private readonly memoryService: AIMemoryService,
    private readonly automationService: AIAutomationService
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const sessionId = ctx.session.config.id;
    const [settings, memory, automation] = await Promise.all([
      this.configService.getSettings(sessionId),
      this.memoryService.getSummary(sessionId),
      this.automationService.getDashboardInfo(sessionId),
    ]);

    const body = [
      `Status:    *${settings.enabled ? 'Active' : 'Inactive'}*`,
      `Provider:  *${settings.provider}*`,
      `Model:     *${settings.model}*`,
      `Prefix:    \`${settings.prefix}\``,
      `Style:     ${settings.responseStyle}`,
      `Language:  ${settings.language}`,
      `API Key:   *${settings.apiKey ? 'Set' : 'Not set'}*`,
      `Memory:    *${settings.memoryEnabled ? 'On' : 'Off'}* (${memory.totalEntries} entries)`,
      `Automations: *${automation.enabled}/${automation.total}* active`,
    ].join('\n');

    await ctx.reply(R.ai(body));
  }
}
