/**
 * PAPPYBOT V2 — OpenAI Provider
 *
 * Calls the OpenAI Chat Completions API (compatible with any OpenAI-spec endpoint).
 * Uses native fetch (Node 18+).
 */

import type { AIProvider } from './AIProvider';
import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('OpenAIProvider');

const BASE_URL = 'https://api.openai.com/v1';

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  supportsVision(): boolean {
    return true;
  }

  async complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult> {
    const url = `${BASE_URL}/chat/completions`;

    const body = {
      model: options.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      log.error('OpenAI API error', { status: res.status });
      throw new Error(`OpenAI API error ${res.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    if (!choice) throw new Error('OpenAI returned no choices');

    return {
      text: choice.message?.content ?? '',
      model: data.model ?? options.model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens,
    };
  }
}
