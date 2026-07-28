/**
 * PAPPYBOT V2 — AI Memory Repository
 *
 * Persists per-session conversation history and context.
 * Memory is strictly isolated per session.
 */

import { BaseRepository } from '../../database/BaseRepository';
import type { DatabaseAdapter } from '../../types/Database';
import type { AIMemoryEntry, AIMemorySummary } from '../types/AITypes';
import { v4 as uuidv4 } from 'uuid';

export class AIMemoryRepository extends BaseRepository<AIMemoryEntry> {
  protected readonly tableName = 'ai_memory';

  constructor(adapter: DatabaseAdapter) {
    super(adapter);
  }

  async ensureTable(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id          TEXT PRIMARY KEY,
        session_id  TEXT NOT NULL,
        role        TEXT NOT NULL,
        content     TEXT NOT NULL,
        timestamp   INTEGER NOT NULL
      )
    `);
    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_ai_memory_session ON ${this.tableName}(session_id, timestamp)`
    );
  }

  async add(entry: Omit<AIMemoryEntry, 'id'>): Promise<AIMemoryEntry> {
    const id = uuidv4();
    await this.execute(
      `INSERT INTO ${this.tableName} (id, session_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)`,
      [id, entry.sessionId, entry.role, entry.content, entry.timestamp]
    );
    return { ...entry, id };
  }

  /**
   * Retrieve the N most recent entries for a session (oldest first for chat context).
   */
  async getRecent(sessionId: string, limit = 20): Promise<AIMemoryEntry[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT * FROM (
        SELECT * FROM ${this.tableName} WHERE session_id = ?
        ORDER BY timestamp DESC LIMIT ?
      ) ORDER BY timestamp ASC`,
      [sessionId, limit]
    );
    return rows.map(this.rowToEntry);
  }

  /**
   * Delete all memory entries for a session.
   */
  async clearSession(sessionId: string): Promise<number> {
    const result = await this.execute(
      `DELETE FROM ${this.tableName} WHERE session_id = ?`,
      [sessionId]
    );
    return result.rowCount;
  }

  /**
   * Keep only the N most recent entries, prune the rest.
   */
  async prune(sessionId: string, keepLast = 100): Promise<void> {
    await this.execute(
      `DELETE FROM ${this.tableName}
       WHERE session_id = ? AND id NOT IN (
         SELECT id FROM ${this.tableName}
         WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?
       )`,
      [sessionId, sessionId, keepLast]
    );
  }

  async summary(sessionId: string): Promise<AIMemorySummary> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT COUNT(*) as cnt, MIN(timestamp) as oldest, MAX(timestamp) as newest
       FROM ${this.tableName} WHERE session_id = ?`,
      [sessionId]
    );
    const row = rows[0] ?? {};
    return {
      sessionId,
      totalEntries: Number(row['cnt'] ?? 0),
      oldestEntry: row['oldest'] ? Number(row['oldest']) : undefined,
      newestEntry: row['newest'] ? Number(row['newest']) : undefined,
    };
  }

  private rowToEntry(row: Record<string, unknown>): AIMemoryEntry {
    return {
      id: String(row['id'] ?? ''),
      sessionId: String(row['session_id'] ?? ''),
      role: (row['role'] as AIMemoryEntry['role']) ?? 'user',
      content: String(row['content'] ?? ''),
      timestamp: Number(row['timestamp'] ?? 0),
    };
  }
}
