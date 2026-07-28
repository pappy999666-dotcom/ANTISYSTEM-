/**
 * PAPPYBOT V2 — AI Memory Service
 *
 * Manages per-session conversation memory.
 * Enforces isolation: one session cannot read another's memory.
 */

import { BaseService } from '../../services/BaseService';
import type { AIMemoryRepository } from '../repository/AIMemoryRepository';
import type { AIMemoryEntry, AIChatMessage, AIMemorySummary } from '../types/AITypes';

const MAX_CONTEXT_ENTRIES = 20;  // sent to AI per request
const MAX_STORED_ENTRIES = 200;  // pruned when exceeded

export class AIMemoryService extends BaseService {
  constructor(private readonly repo: AIMemoryRepository) {
    super();
  }

  async addUserMessage(sessionId: string, content: string): Promise<void> {
    await this.repo.add({ sessionId, role: 'user', content, timestamp: Date.now() });
    await this.maybePrune(sessionId);
  }

  async addAssistantMessage(sessionId: string, content: string): Promise<void> {
    await this.repo.add({ sessionId, role: 'assistant', content, timestamp: Date.now() });
    await this.maybePrune(sessionId);
  }

  async addSystemNote(sessionId: string, content: string): Promise<void> {
    await this.repo.add({ sessionId, role: 'system', content, timestamp: Date.now() });
  }

  /**
   * Return recent entries formatted as chat messages for the AI context window.
   */
  async getContextMessages(sessionId: string): Promise<AIChatMessage[]> {
    const entries = await this.repo.getRecent(sessionId, MAX_CONTEXT_ENTRIES);
    return entries.map((e) => ({ role: e.role, content: e.content }));
  }

  async clearSession(sessionId: string): Promise<number> {
    const count = await this.repo.clearSession(sessionId);
    this.log.info('Memory cleared', { sessionId, count });
    return count;
  }

  async getSummary(sessionId: string): Promise<AIMemorySummary> {
    return this.repo.summary(sessionId);
  }

  private async maybePrune(sessionId: string): Promise<void> {
    const summary = await this.repo.summary(sessionId);
    if (summary.totalEntries > MAX_STORED_ENTRIES) {
      await this.repo.prune(sessionId, MAX_STORED_ENTRIES);
    }
  }
}
