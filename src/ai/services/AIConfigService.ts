/**
 * PAPPYBOT V2 — AI Config Service
 *
 * CRUD operations for per-session AI settings.
 * Single source of truth for enabling/disabling AI, switching providers, etc.
 */

import { BaseService } from '../../services/BaseService';
import type { AISettingsRepository } from '../repository/AISettingsRepository';
import type { AISessionSettings, AIProviderName, AIResponseStyle } from '../types/AITypes';
import { listProviders } from '../providers/ProviderFactory';

export class AIConfigService extends BaseService {
  constructor(private readonly repo: AISettingsRepository) {
    super();
  }

  async getSettings(sessionId: string): Promise<AISessionSettings> {
    return this.repo.getOrCreate(sessionId);
  }

  async enable(sessionId: string): Promise<AISessionSettings> {
    this.log.info('AI enabled', { sessionId });
    return this.repo.patch(sessionId, { enabled: true });
  }

  async disable(sessionId: string): Promise<AISessionSettings> {
    this.log.info('AI disabled', { sessionId });
    return this.repo.patch(sessionId, { enabled: false });
  }

  async setProvider(sessionId: string, provider: string): Promise<AISessionSettings> {
    const valid = listProviders();
    if (!valid.includes(provider as AIProviderName)) {
      throw new Error(`Unknown provider "${provider}". Valid: ${valid.join(', ')}`);
    }
    return this.repo.patch(sessionId, { provider: provider as AIProviderName });
  }

  async setApiKey(sessionId: string, apiKey: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { apiKey });
  }

  async setModel(sessionId: string, model: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { model });
  }

  async setPrefix(sessionId: string, prefix: string): Promise<AISessionSettings> {
    if (!prefix.trim()) throw new Error('Prefix cannot be empty');
    return this.repo.patch(sessionId, { prefix: prefix.trim().toLowerCase() });
  }

  async setResponseStyle(sessionId: string, style: string): Promise<AISessionSettings> {
    const valid: AIResponseStyle[] = ['professional', 'friendly', 'short', 'detailed', 'minimal'];
    if (!valid.includes(style as AIResponseStyle)) {
      throw new Error(`Unknown style "${style}". Valid: ${valid.join(', ')}`);
    }
    return this.repo.patch(sessionId, { responseStyle: style as AIResponseStyle });
  }

  async enableMemory(sessionId: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { memoryEnabled: true });
  }

  async disableMemory(sessionId: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { memoryEnabled: false });
  }

  async enableAutomation(sessionId: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { automationEnabled: true });
  }

  async disableAutomation(sessionId: string): Promise<AISessionSettings> {
    return this.repo.patch(sessionId, { automationEnabled: false });
  }

  async isEnabled(sessionId: string): Promise<boolean> {
    const s = await this.repo.get(sessionId);
    return s?.enabled ?? false;
  }

  formatInfo(s: AISessionSettings): string {
    return [
      `🤖 *AI Assistant — Session ${s.sessionId}*`,
      `Status: ${s.enabled ? '✅ Enabled' : '❌ Disabled'}`,
      `Provider: ${s.provider}`,
      `Model: ${s.model}`,
      `Prefix: \`${s.prefix}\``,
      `Memory: ${s.memoryEnabled ? 'On' : 'Off'}`,
      `Automation: ${s.automationEnabled ? 'On' : 'Off'}`,
      `Style: ${s.responseStyle}`,
      `Language: ${s.language}`,
      `API Key: ${s.apiKey ? '***set***' : '❌ not set'}`,
    ].join('\n');
  }
}
