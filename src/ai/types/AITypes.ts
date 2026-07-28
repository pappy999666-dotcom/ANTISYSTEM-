/**
 * PAPPYBOT V2 — AI Assistant Types
 *
 * All shared interfaces and enums for the AI subsystem.
 * Providers, session settings, memory, automation tasks, and planner actions.
 */

// ── Provider ────────────────────────────────────────────────────────────────

export type AIProviderName =
  | 'openai'
  | 'groq'
  | 'gemini'
  | 'anthropic'
  | 'openrouter';

export type AIResponseStyle = 'professional' | 'friendly' | 'short' | 'detailed' | 'minimal';

// ── Chat messages ───────────────────────────────────────────────────────────

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | AIChatContent[];
}

export interface AIChatContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface AICompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  /** Raw API key — never logged */
  apiKey: string;
}

export interface AICompletionResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// ── Session AI Settings ─────────────────────────────────────────────────────

export interface AISessionSettings {
  sessionId: string;
  enabled: boolean;
  provider: AIProviderName;
  /** Stored encrypted-at-rest in DB; never logged */
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  memoryEnabled: boolean;
  automationEnabled: boolean;
  responseStyle: AIResponseStyle;
  language: string;
  /** The natural-language prefix that triggers AI (e.g. "pappy") */
  prefix: string;
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_AI_SETTINGS: Omit<AISessionSettings, 'sessionId' | 'createdAt' | 'updatedAt'> = {
  enabled: false,
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1024,
  memoryEnabled: true,
  automationEnabled: true,
  responseStyle: 'friendly',
  language: 'en',
  prefix: 'pappy',
};

// ── Memory ──────────────────────────────────────────────────────────────────

export interface AIMemoryEntry {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIMemorySummary {
  sessionId: string;
  totalEntries: number;
  oldestEntry?: number;
  newestEntry?: number;
}

// ── Automation ──────────────────────────────────────────────────────────────

export interface AIAutomationTask {
  id: string;
  sessionId: string;
  name: string;
  description: string;
  cronExpression: string;
  actionType: AIActionType;
  actionData: Record<string, unknown>;
  targetJid?: string;
  enabled: boolean;
  createdAt: number;
  lastRun?: number;
  runCount: number;
}

// ── Action Plan ─────────────────────────────────────────────────────────────

export type AIActionType =
  | 'send_message'
  | 'open_group'
  | 'close_group'
  | 'mute_group'
  | 'unmute_group'
  | 'kick_user'
  | 'promote_user'
  | 'demote_user'
  | 'warn_user'
  | 'enable_feature'
  | 'disable_feature'
  | 'get_info'
  | 'list_members'
  | 'create_poll'
  | 'schedule_task'
  | 'cancel_task'
  | 'list_tasks'
  | 'ai_config'
  | 'reply_text'
  | 'unknown';

export interface AIActionStep {
  type: AIActionType;
  description: string;
  params: Record<string, unknown>;
  requiresConfirmation?: boolean;
}

export interface AIPlan {
  intent: string;
  confidence: number;
  steps: AIActionStep[];
  scheduledAt?: string;      // ISO or natural-language time string
  cronExpression?: string;   // if recurring
  isRecurring: boolean;
  rawQuery: string;
  error?: string;
}

// ── Planner request context ─────────────────────────────────────────────────

export interface AIRequestContext {
  sessionId: string;
  senderJid: string;
  chatJid: string;
  chatType: 'private' | 'group';
  query: string;
  /** Previous conversation turns (most recent last, limited to last N) */
  history: AIChatMessage[];
  quotedText?: string;
  mediaType?: string;
}

// ── Logging ─────────────────────────────────────────────────────────────────

export interface AIExecutionLog {
  requestId: string;
  sessionId: string;
  provider: AIProviderName;
  model: string;
  query: string;
  plan: AIPlan;
  success: boolean;
  durationMs: number;
  tokensUsed?: number;
  error?: string;
  timestamp: number;
}
