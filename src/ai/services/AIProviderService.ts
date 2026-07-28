/**
 * PAPPYBOT V2 — AI Provider Service
 *
 * Wires the provider factory to session settings.
 * Single call surface for "call the AI for this session".
 */

import { BaseService } from '../../services/BaseService';
import type { AIConfigService } from './AIConfigService';
import { createProvider } from '../providers/ProviderFactory';
import type { AIChatMessage, AICompletionResult, AIResponseStyle } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('AIProviderService');

const STYLE_INSTRUCTIONS: Record<AIResponseStyle, string> = {
  professional: 'Respond in a professional, formal tone. Be clear and concise.',
  friendly: 'Respond in a warm, friendly conversational tone.',
  short: 'Respond as briefly as possible. One or two sentences maximum.',
  detailed: 'Provide thorough, detailed explanations with examples where helpful.',
  minimal: 'Respond with the bare minimum information needed. No pleasantries.',
};

export class AIProviderService extends BaseService {
  constructor(private readonly configService: AIConfigService) {
    super();
  }

  /**
   * Call the configured AI provider for a session.
   * Prepends a system prompt with style and context instructions.
   */
  async complete(
    sessionId: string,
    messages: AIChatMessage[],
    systemContext?: string
  ): Promise<AICompletionResult> {
    const settings = await this.configService.getSettings(sessionId);

    if (!settings.apiKey) {
      throw new Error('AI API key not configured. Use .setaitoken <key> to set it.');
    }

    const styleInstruction = STYLE_INSTRUCTIONS[settings.responseStyle];
    const systemParts = [
      `You are Pappy, an intelligent WhatsApp bot assistant managing session "${sessionId}".`,
      styleInstruction,
      `Always respond in ${settings.language === 'en' ? 'English' : settings.language}.`,
      `You help the session owner manage their WhatsApp bot, groups, and automation.`,
      `Only execute actions for users with SESSION_OWNER or SUDO permission.`,
      systemContext ?? '',
    ].filter(Boolean);

    const fullMessages: AIChatMessage[] = [
      { role: 'system', content: systemParts.join('\n') },
      ...messages,
    ];

    const provider = createProvider(settings.provider);

    const start = Date.now();
    const result = await provider.complete(fullMessages, {
      model: settings.model,
      apiKey: settings.apiKey,
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    });

    log.info('AI completion', {
      sessionId,
      provider: settings.provider,
      model: result.model,
      tokens: result.totalTokens,
      durationMs: Date.now() - start,
    });

    return result;
  }

  async supportsVision(sessionId: string): Promise<boolean> {
    const settings = await this.configService.getSettings(sessionId);
    const provider = createProvider(settings.provider);
    return provider.supportsVision();
  }
}
