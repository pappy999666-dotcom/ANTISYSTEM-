/**
 * PAPPYBOT V2 — AI Provider Interface
 *
 * All AI provider implementations must satisfy this interface.
 * Swap providers without touching business logic.
 */

import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';

export interface AIProvider {
  /** Provider identifier */
  readonly name: string;

  /**
   * Send a chat completion request.
   * @param messages  Conversation history (system + turns)
   * @param options   Model, temperature, maxTokens, apiKey
   */
  complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult>;

  /**
   * Check whether this provider supports multimodal (image) input.
   */
  supportsVision(): boolean;
}
