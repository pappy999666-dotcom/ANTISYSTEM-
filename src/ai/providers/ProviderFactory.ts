/**
 * PAPPYBOT V2 — AI Provider Factory
 *
 * Instantiates the correct AIProvider implementation from a provider name.
 * Add new providers here without touching any other code.
 */

import type { AIProvider } from './AIProvider';
import type { AIProviderName } from '../types/AITypes';
import { OpenAIProvider } from './OpenAIProvider';
import { GroqProvider } from './GroqProvider';
import { GeminiProvider } from './GeminiProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { OpenRouterProvider } from './OpenRouterProvider';

const providerCache = new Map<AIProviderName, AIProvider>();

export function createProvider(name: AIProviderName): AIProvider {
  if (providerCache.has(name)) {
    return providerCache.get(name)!;
  }

  let provider: AIProvider;
  switch (name) {
    case 'openai':
      provider = new OpenAIProvider();
      break;
    case 'groq':
      provider = new GroqProvider();
      break;
    case 'gemini':
      provider = new GeminiProvider();
      break;
    case 'anthropic':
      provider = new AnthropicProvider();
      break;
    case 'openrouter':
      provider = new OpenRouterProvider();
      break;
    default:
      throw new Error(`Unknown AI provider: ${name as string}`);
  }

  providerCache.set(name, provider);
  return provider;
}

export function listProviders(): AIProviderName[] {
  return ['openai', 'groq', 'gemini', 'anthropic', 'openrouter'];
}
