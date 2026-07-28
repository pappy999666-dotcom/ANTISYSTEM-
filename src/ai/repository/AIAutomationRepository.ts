/**
 * PAPPYBOT V2 — AI Automation Repository
 *
 * Persists scheduled automation tasks so they survive restarts.
 * Each session owns its own automations.
 */

import { BaseRepository } from '../../database/BaseRepository';
import type { DatabaseAdapter } from '../../types/Database';
import type { AIAutomationTask } from '../types/AITypes';
import { v4 as uuidv4 } from 'uuid';

export class AIAutomationRepository extends BaseRepository<AIAutomationTask> {
  protected readonly tableName = 'ai_automations';

  constructor(adapter: DatabaseAdapter) {
    super(adapter);
  }

  async ensureTable(): Promise<void> {
    await this.execute(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        id              TEXT PRIMARY KEY,
        session_id      TEXT NOT NULL,
        name            TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        cron_expression TEXT NOT NULL,
        action_type     TEXT NOT NULL,
        action_data     TEXT NOT NULL DEFAULT '{}',
        target_jid      TEXT,
        enabled         INTEGER NOT NULL DEFAULT 1,
        created_at      INTEGER NOT NULL,
        last_run        INTEGER,
        run_count       INTEGER NOT NULL DEFAULT 0
      )
    `);
    await this.execute(
      `CREATE INDEX IF NOT EXISTS idx_ai_auto_session ON ${this.tableName}(session_id)`
    );
  }

  async create(task: Omit<AIAutomationTask, 'id' | 'createdAt' | 'runCount'>): Promise<AIAutomationTask> {
    const id = uuidv4();
    const now = Date.now();
    const full: AIAutomationTask = { ...task, id, createdAt: now, runCount: 0 };
    await this.execute(
      `INSERT INTO ${this.tableName}
         (id, session_id, name, description, cron_expression, action_type, action_data,
          target_jid, enabled, created_at, last_run, run_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id, full.sessionId, full.name, full.description, full.cronExpression,
        full.actionType, JSON.stringify(full.actionData), full.targetJid ?? null,
        full.enabled ? 1 : 0, full.createdAt, null, 0,
      ]
    );
    return full;
  }

  async getById(id: string): Promise<AIAutomationTask | null> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`, [id]
    );
    return rows.length ? this.rowToTask(rows[0]) : null;
  }

  async listBySession(sessionId: string): Promise<AIAutomationTask[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE session_id = ? ORDER BY created_at ASC`,
      [sessionId]
    );
    return rows.map(this.rowToTask);
  }

  async listAllEnabled(): Promise<AIAutomationTask[]> {
    const rows = await this.query<Record<string, unknown>>(
      `SELECT * FROM ${this.tableName} WHERE enabled = 1`
    );
    return rows.map(this.rowToTask);
  }

  async setEnabled(id: string, enabled: boolean): Promise<void> {
    await this.execute(
      `UPDATE ${this.tableName} SET enabled = ? WHERE id = ?`,
      [enabled ? 1 : 0, id]
    );
  }

  async recordRun(id: string): Promise<void> {
    await this.execute(
      `UPDATE ${this.tableName} SET last_run = ?, run_count = run_count + 1 WHERE id = ?`,
      [Date.now(), id]
    );
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.execute(
      `DELETE FROM ${this.tableName} WHERE id = ?`, [id]
    );
    return result.rowCount > 0;
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.execute(
      `DELETE FROM ${this.tableName} WHERE session_id = ?`, [sessionId]
    );
  }

  private rowToTask(row: Record<string, unknown>): AIAutomationTask {
    return {
      id: String(row['id'] ?? ''),
      sessionId: String(row['session_id'] ?? ''),
      name: String(row['name'] ?? ''),
      description: String(row['description'] ?? ''),
      cronExpression: String(row['cron_expression'] ?? ''),
      actionType: row['action_type'] as AIAutomationTask['actionType'],
      actionData: JSON.parse(String(row['action_data'] ?? '{}')),
      targetJid: row['target_jid'] ? String(row['target_jid']) : undefined,
      enabled: Number(row['enabled']) === 1,
      createdAt: Number(row['created_at'] ?? 0),
      lastRun: row['last_run'] ? Number(row['last_run']) : undefined,
      runCount: Number(row['run_count'] ?? 0),
    };
  }
}
