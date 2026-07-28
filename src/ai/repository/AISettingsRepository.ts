/**
 * PAPPYBOT V2 — AI Settings Repository
 *
 * Persists per-session AI configuration in the active database.
 * Handles SQLite, MongoDB, and PostgreSQL transparently via DatabaseAdapter.
 */

import { BaseRepository } from '../../database/BaseRepository';
import type { DatabaseAdapter } from '../../types/Database';
import type { AISessionSettings } from '../types/AITypes';
import { DEFAULT_AI_SETTINGS } from '../types/AITypes';
import { v4 as uuidv4 } from 'uuid';

export class AISettingsRepository extends BaseRepository<AISessionSettings> {
  protected readonly tableName = 'ai_settings';

  constructor(adapter: DatabaseAdapter) {
    super(adapter);
  }

  async ensureTable(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        session_id        TEXT PRIMARY KEY,
        enabled           INTEGER NOT NULL DEFAULT 0,
        provider          TEXT NOT NULL DEFAULT 'openai',
        api_key           TEXT NOT NULL DEFAULT '',
        model             TEXT NOT NULL DEFAULT 'gpt-4o-mini',
        temperature       REAL NOT NULL DEFAULT 0.7,
        max_tokens        INTEGER NOT NULL DEFAULT 1024,
        memory_enabled    INTEGER NOT NULL DEFAULT 1,
        automation_enabled INTEGER NOT NULL DEFAULT 1,
        response_style    TEXT NOT NULL DEFAULT 'friendly',
        language          TEXT NOT NULL DEFAULT 'en',
        prefix            TEXT NOT NULL DEFAULT 'pappy',
        created_at        INTEGER NOT NULL,
        updated_at        INTEGER NOT NULL
      )
    `);
  }

  async get(sessionId: string): Promise<AISessionSettings | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE session_id = ?`,
      [sessionId]
    );
    if (rows.length === 0) return null;
    return this.rowToSettings(rows[0]);
  }

  async getOrCreate(sessionId: string): Promise<AISessionSettings> {
    const existing = await this.get(sessionId);
    if (existing) return existing;
    const now = Date.now();
    const settings: AISessionSettings = {
      ...DEFAULT_AI_SETTINGS,
      sessionId,
      createdAt: now,
      updatedAt: now,
    };
    await this.save(settings);
    return settings;
  }

  async save(settings: AISessionSettings): Promise<void> {
    const now = Date.now();
    await this.execute(
      `INSERT INTO ${this.tableName}
         (session_id, enabled, provider, api_key, model, temperature, max_tokens,
          memory_enabled, automation_enabled, response_style, language, prefix,
          created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         enabled = excluded.enabled,
         provider = excluded.provider,
         api_key = excluded.api_key,
         model = excluded.model,
         temperature = excluded.temperature,
         max_tokens = excluded.max_tokens,
         memory_enabled = excluded.memory_enabled,
         automation_enabled = excluded.automation_enabled,
         response_style = excluded.response_style,
         language = excluded.language,
         prefix = excluded.prefix,
         updated_at = excluded.updated_at`,
      [
        settings.sessionId,
        settings.enabled ? 1 : 0,
        settings.provider,
        settings.apiKey,
        settings.model,
        settings.temperature,
        settings.maxTokens,
        settings.memoryEnabled ? 1 : 0,
        settings.automationEnabled ? 1 : 0,
        settings.responseStyle,
        settings.language,
        settings.prefix,
        settings.createdAt,
        now,
      ]
    );
  }

  async patch(sessionId: string, partial: Partial<Omit<AISessionSettings, 'sessionId' | 'createdAt'>>): Promise<AISessionSettings> {
    const current = await this.getOrCreate(sessionId);
    const updated: AISessionSettings = { ...current, ...partial, sessionId, updatedAt: Date.now() };
    await this.save(updated);
    return updated;
  }

  private rowToSettings(row: Record<string, unknown>): AISessionSettings {
    return {
      sessionId: String(row['session_id'] ?? ''),
      enabled: Number(row['enabled']) === 1,
      provider: (row['provider'] as AISessionSettings['provider']) ?? 'openai',
      apiKey: String(row['api_key'] ?? ''),
      model: String(row['model'] ?? 'gpt-4o-mini'),
      temperature: Number(row['temperature'] ?? 0.7),
      maxTokens: Number(row['max_tokens'] ?? 1024),
      memoryEnabled: Number(row['memory_enabled']) === 1,
      automationEnabled: Number(row['automation_enabled']) === 1,
      responseStyle: (row['response_style'] as AISessionSettings['responseStyle']) ?? 'friendly',
      language: String(row['language'] ?? 'en'),
      prefix: String(row['prefix'] ?? 'pappy'),
      createdAt: Number(row['created_at'] ?? 0),
      updatedAt: Number(row['updated_at'] ?? 0),
    };
  }
}
