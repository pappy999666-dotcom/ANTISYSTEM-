/**
 * .aimemory on|off — Toggle AI memory for the session.
 * .aiclear — Clear all conversation memory.
 * Requires: SESSION_OWNER
 */

import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { AIConfigService } from '../services/AIConfigService';
import type { AIMemoryService } from '../services/AIMemoryService';

export class AiMemoryCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'aimemory',
    description: 'Toggle AI memory on or off',
    usage: '.aimemory on | .aimemory off',
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(
    private readonly configService: AIConfigService,
    private readonly memoryService: AIMemoryService
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const sub = ctx.args.argv[0]?.toLowerCase();
    const sessionId = ctx.session.config.id;

    if (sub === 'on') {
      await this.configService.enableMemory(sessionId);
      await this.replySuccess(ctx, 'AI memory enabled. Conversation context will be remembered.');
    } else if (sub === 'off') {
      await this.configService.disableMemory(sessionId);
      await this.replySuccess(ctx, 'AI memory disabled. Each request starts fresh.');
    } else {
      const summary = await this.memoryService.getSummary(sessionId);
      await ctx.reply(
        `🧠 *AI Memory*\nEntries: ${summary.totalEntries}\nUsage: \`.aimemory on\` / \`.aimemory off\` / \`.aiclear\``
      );
    }
  }
}

export class AiClearCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'aiclear',
    description: 'Clear all AI conversation memory for this session',
    usage: '.aiclear',
    category: 'ai',
    requiredRole: 'SESSION_OWNER',
    ownerOnly: true,
  };

  constructor(
    private readonly configService: AIConfigService,
    private readonly memoryService: AIMemoryService
  ) {
    super();
  }

  async execute(ctx: CommandContext): Promise<void> {
    const count = await this.memoryService.clearSession(ctx.session.config.id);
    await this.replySuccess(ctx, `AI memory cleared. Removed ${count} conversation entries.`);
  }
}
