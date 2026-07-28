/**
 * PAPPYBOT V2 — Anthropic Claude Provider
 *
 * Calls the Anthropic Messages API.
 */

import type { AIProvider } from './AIProvider';
import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('AnthropicProvider');
const BASE_URL = 'https://api.anthropic.com/v1';

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  supportsVision(): boolean {
    return true;
  }

  async complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult> {
    const systemMsg = messages.find((m) => m.role === 'system');
    const turns = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: options.model || 'claude-3-haiku-20240307',
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
      messages: turns.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content,
      })),
    };
    if (systemMsg) {
      body['system'] = typeof systemMsg.content === 'string' ? systemMsg.content : '';
    }

    const res = await fetch(`${BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      log.error('Anthropic API error', { status: res.status });
      throw new Error(`Anthropic API error ${res.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const text = data.content?.[0]?.text ?? '';
    const usage = data.usage;

    return {
      text,
      model: data.model ?? options.model,
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
      totalTokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
  }
}
