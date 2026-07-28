/**
 * PAPPYBOT V2 — OpenRouter Provider
 *
 * Calls OpenRouter (OpenAI-compatible endpoint that proxies many models).
 */

import type { AIProvider } from './AIProvider';
import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('OpenRouterProvider');
const BASE_URL = 'https://openrouter.ai/api/v1';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';

  supportsVision(): boolean {
    return true; // model-dependent; we optimistically declare true
  }

  async complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult> {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
        'HTTP-Referer': 'https://github.com/pappybot',
        'X-Title': 'PappyBot V2',
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
      log.error('OpenRouter API error', { status: res.status });
      throw new Error(`OpenRouter API error ${res.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    if (!choice) throw new Error('OpenRouter returned no choices');

    return {
      text: choice.message?.content ?? '',
      model: data.model ?? options.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    };
  }
}
