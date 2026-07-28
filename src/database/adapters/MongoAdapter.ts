/**
 * PAPPYBOT V2 — MongoDB Database Adapter
 * Uses mongoose under the hood. Exposes a thin SQL-like interface
 * for compatibility with the DatabaseAdapter contract.
 *
 * NOTE: MongoDB is document-oriented. Use the Mongoose model API directly
 * in repositories for complex queries; this adapter handles connection lifecycle.
 */

import type { DatabaseAdapter, QueryResult } from '../../types/Database';
import { logger } from '../../logger/Logger';

const log = logger.child('MongoAdapter');

export class MongoAdapter implements DatabaseAdapter {
  private connected = false;
  private readonly uri: string;
  private readonly dbName: string;

  constructor(uri: string, dbName: string) {
    this.uri = uri;
    this.dbName = dbName;
  }

  async connect(): Promise<void> {
    const mongoose = await import('mongoose');
    await mongoose.default.connect(this.uri, { dbName: this.dbName });
    this.connected = true;
    log.info('MongoDB connected', { dbName: this.dbName });
  }

  async disconnect(): Promise<void> {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
    this.connected = false;
    log.info('MongoDB disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // MongoDB is not SQL; raw SQL queries are not supported.
  // Repositories should use Mongoose models directly instead.
  // These stubs exist to satisfy the DatabaseAdapter interface.
  // ──────────────────────────────────────────────────────────────────────────

  async query<T = unknown>(_sql: string, _params?: unknown[]): Promise<QueryResult<T>> {
    throw new Error('MongoAdapter: use Mongoose models for queries, not raw SQL');
  }

  async execute(_sql: string, _params?: unknown[]): Promise<QueryResult> {
    throw new Error('MongoAdapter: use Mongoose models for mutations, not raw SQL');
  }

  async beginTransaction(): Promise<void> {
    log.warn('MongoAdapter: transactions require a replica set. Use sessions instead.');
  }

  async commit(): Promise<void> { /* no-op */ }
  async rollback(): Promise<void> { /* no-op */ }
}
