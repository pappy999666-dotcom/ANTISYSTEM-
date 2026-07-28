/**
 * PAPPYBOT V2 — SQLite Database Adapter
 * Uses better-sqlite3 for synchronous, embedded SQLite access.
 */

import fs from 'fs';
import path from 'path';
import type Database from 'better-sqlite3';
import type { DatabaseAdapter, QueryResult } from '../../types/Database';
import { logger } from '../../logger/Logger';

const log = logger.child('SQLiteAdapter');

export class SQLiteAdapter implements DatabaseAdapter {
  private db?: Database.Database;
  private connected = false;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async connect(): Promise<void> {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });

    // Lazy-require to avoid loading native addon until needed
    const BetterSqlite3 = (await import('better-sqlite3')).default;
    this.db = new BetterSqlite3(this.filePath);

    // Performance pragmas
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.connected = true;
    log.info('SQLite connected', { path: this.filePath });
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.connected = false;
    log.info('SQLite disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.assertConnected();
    try {
      const stmt = this.db!.prepare(sql);
      const rows = stmt.all(...params) as T[];
      return { rows, rowCount: rows.length };
    } catch (err) {
      log.error('SQLite query error', { sql, error: String(err) });
      throw err;
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    this.assertConnected();
    try {
      const stmt = this.db!.prepare(sql);
      const result = stmt.run(...params);
      return {
        rows: [],
        rowCount: result.changes,
        lastInsertId: result.lastInsertRowid as number,
      };
    } catch (err) {
      log.error('SQLite execute error', { sql, error: String(err) });
      throw err;
    }
  }

  async beginTransaction(): Promise<void> {
    this.db!.prepare('BEGIN').run();
  }

  async commit(): Promise<void> {
    this.db!.prepare('COMMIT').run();
  }

  async rollback(): Promise<void> {
    this.db!.prepare('ROLLBACK').run();
  }

  private assertConnected(): void {
    if (!this.connected || !this.db) {
      throw new Error('SQLiteAdapter: not connected');
    }
  }
}
