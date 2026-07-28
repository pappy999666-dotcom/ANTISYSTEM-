/**
 * PAPPYBOT V2 — Google Gemini Provider
 *
 * Calls the Gemini generateContent REST API.
 * Maps OpenAI-style messages to Gemini's "contents" format.
 */

import type { AIProvider } from './AIProvider';
import type { AIChatMessage, AICompletionOptions, AICompletionResult } from '../types/AITypes';
import { logger } from '../../logger/Logger';

const log = logger.child('GeminiProvider');
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  supportsVision(): boolean {
    return true;
  }

  async complete(messages: AIChatMessage[], options: AICompletionOptions): Promise<AICompletionResult> {
    const model = options.model || 'gemini-1.5-flash';
    const url = `${BASE_URL}/${model}:generateContent?key=${options.apiKey}`;

    // Extract system instruction
    const systemMsg = messages.find((m) => m.role === 'system');
    const systemInstruction = systemMsg
      ? { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : '' }] }
      : undefined;

    // Map non-system messages to Gemini contents
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
      },
    };
    if (systemInstruction) body['system_instruction'] = systemInstruction;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      log.error('Gemini API error', { status: res.status });
      throw new Error(`Gemini API error ${res.status}: ${err}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage = data.usageMetadata;

    return {
      text,
      model,
      promptTokens: usage?.promptTokenCount,
      completionTokens: usage?.candidatesTokenCount,
      totalTokens: usage?.totalTokenCount,
    };
  }
}
