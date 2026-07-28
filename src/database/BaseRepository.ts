/**
 * PAPPYBOT V2 — Base Repository
 *
 * All data-access classes must extend this.
 * Provides a typed query interface and shields business logic
 * from direct adapter usage.
 */

import type { DatabaseAdapter, QueryResult } from '../types/Database';
import { logger } from '../logger/Logger';

export abstract class BaseRepository<T = unknown> {
  protected readonly log = logger.child(this.constructor.name);
  protected readonly db: DatabaseAdapter;

  /** Table or collection name */
  protected abstract readonly tableName: string;

  constructor(adapter: DatabaseAdapter) {
    this.db = adapter;
  }

  /**
   * Run a SELECT query and return typed rows.
   */
  protected async query<R = T>(sql: string, params?: unknown[]): Promise<R[]> {
    const result: QueryResult<R> = await this.db.query<R>(sql, params);
    return result.rows;
  }

  /**
   * Run an INSERT/UPDATE/DELETE and return affected row count.
   */
  protected async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    return this.db.execute(sql, params);
  }

  /**
   * Run multiple statements in a transaction.
   */
  protected async transaction<R>(fn: () => Promise<R>): Promise<R> {
    await this.db.beginTransaction();
    try {
      const result = await fn();
      await this.db.commit();
      return result;
    } catch (err) {
      await this.db.rollback();
      throw err;
    }
  }
}
