/**
 * PAPPYBOT V2 — AI Plugin
 *
 * Entry point for the entire AI subsystem.
 * Wired into App.ts alongside Group Management and GStatus plugins.
 */

import { BasePlugin, type PluginContext } from '../../plugins/BasePlugin';
import type { PluginMeta } from '../../types/Plugin';
import { container } from '../../core/Container';
import type { DatabaseManager } from '../../database/DatabaseManager';

// Repositories
import { AISettingsRepository } from '../repository/AISettingsRepository';
import { AIMemoryRepository } from '../repository/AIMemoryRepository';
import { AIAutomationRepository } from '../repository/AIAutomationRepository';

// Services
import { AIConfigService } from '../services/AIConfigService';
import { AIMemoryService } from '../services/AIMemoryService';
import { AIProviderService } from '../services/AIProviderService';
import { AIPlannerService } from '../services/AIPlannerService';
import { AIExecutorService } from '../services/AIExecutorService';
import { AIAutomationService } from '../services/AIAutomationService';

// Commands
import { AiOnCommand } from '../commands/AiOnCommand';
import { SetAiPrefixCommand } from '../commands/SetAiPrefixCommand';
import { SetAiProviderCommand } from '../commands/SetAiProviderCommand';
import { SetAiModelCommand } from '../commands/SetAiModelCommand';
import { SetAiTokenCommand } from '../commands/SetAiTokenCommand';
import { AiInfoCommand } from '../commands/AiInfoCommand';
import { AiMemoryCommand, AiClearCommand } from '../commands/AiMemoryCommand';

// Listener
import { AIMessageListener } from '../listener/AIMessageListener';

export class AIPlugin extends BasePlugin {
  readonly meta: PluginMeta = {
    id: 'ai-assistant',
    name: 'AI Assistant & Automation Engine',
    version: '1.0.0',
    description:
      'Intelligent AI assistant with natural language control, task planning, memory, and automation scheduling.',
  };

  private automationService?: AIAutomationService;

  async load(ctx: PluginContext): Promise<void> {
    this.log.info('Loading AI plugin...');

    // ── Repositories ──────────────────────────────────────────────────────
    const dbManager = container.resolve<DatabaseManager>('DatabaseManager');
    const adapter = dbManager.getAdapter();

    const settingsRepo = new AISettingsRepository(adapter);
    const memoryRepo = new AIMemoryRepository(adapter);
    const automationRepo = new AIAutomationRepository(adapter);

    // Ensure DB tables exist
    await Promise.all([
      settingsRepo.ensureTable(),
      memoryRepo.ensureTable(),
      automationRepo.ensureTable(),
    ]);

    // ── Services ───────────────────────────────────────────────────────────
    const configService = new AIConfigService(settingsRepo);
    const memoryService = new AIMemoryService(memoryRepo);
    const providerService = new AIProviderService(configService);
    const plannerService = new AIPlannerService(providerService, memoryService);
    const executorService = new AIExecutorService();
    this.automationService = new AIAutomationService(automationRepo, ctx.scheduler);

    // Register in container for cross-module access (dashboard, etc.)
    container.register('AIConfigService', configService);
    container.register('AIMemoryService', memoryService);
    container.register('AIProviderService', providerService);
    container.register('AIPlannerService', plannerService);
    container.register('AIExecutorService', executorService);
    container.register('AIAutomationService', this.automationService);

    // ── Commands ───────────────────────────────────────────────────────────
    ctx.commands.registerAll([
      new AiOnCommand(configService),
      new SetAiPrefixCommand(configService),
      new SetAiProviderCommand(configService),
      new SetAiModelCommand(configService),
      new SetAiTokenCommand(configService),
      new AiInfoCommand(configService, memoryService, this.automationService),
      new AiMemoryCommand(configService, memoryService),
      new AiClearCommand(configService, memoryService),
    ]);

    // ── Listener ───────────────────────────────────────────────────────────
    ctx.listeners.register(
      new AIMessageListener(configService, memoryService, plannerService, executorService)
    );

    // ── Restore persisted automations ──────────────────────────────────────
    await this.automationService.restoreAll();

    this.log.success('AI plugin loaded');
  }

  async unload(_ctx: PluginContext): Promise<void> {
    this.log.info('AI plugin unloaded');
  }
}
