/**
 * PAPPYBOT V2 — Groq Provider
 *
 * Calls the Groq Chat Completions API (OpenAI-compatible).
 */

import type { AIProvider } from './AIProvider';
import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('GroqProvider');
const BASE_URL = 'https://api.groq.com/openai/v1';

export class GroqProvider implements AIProvider {
  readonly name = 'groq';

  supportsVision(): boolean {
    return false;
  }

  async complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      log.error('Groq API error', { status: res.status });
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    if (!choice) throw new Error('Groq returned no choices');

    return {
      text: choice.message?.content ?? '',
      model: data.model ?? options.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    };
  }
}
