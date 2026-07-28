/**
 * PAPPYBOT V2 — PostgreSQL Database Adapter
 * Uses the `pg` (node-postgres) library with a connection pool.
 */

import type { Pool, PoolClient } from 'pg';
import type { DatabaseAdapter, QueryResult } from '../../types/Database';
import { logger } from '../../logger/Logger';

const log = logger.child('PostgresAdapter');

interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections?: number;
}

export class PostgresAdapter implements DatabaseAdapter {
  private pool?: Pool;
  private txClient?: PoolClient;
  private connected = false;
  private readonly pgConfig: PostgresConfig;

  constructor(config: PostgresConfig) {
    this.pgConfig = config;
  }

  async connect(): Promise<void> {
    const { Pool } = await import('pg');
    this.pool = new Pool({
      host: this.pgConfig.host,
      port: this.pgConfig.port,
      database: this.pgConfig.database,
      user: this.pgConfig.user,
      password: this.pgConfig.password,
      max: this.pgConfig.maxConnections ?? 10,
    });
    // Test the connection
    const client = await this.pool.connect();
    client.release();
    this.connected = true;
    log.info('PostgreSQL connected', { host: this.pgConfig.host, db: this.pgConfig.database });
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.connected = false;
    log.info('PostgreSQL disconnected');
  }

  isConnected(): boolean {
    return this.connected;
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    this.assertConnected();
    const client = this.txClient ?? this.pool!;
    try {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
    } catch (err) {
      log.error('PostgreSQL query error', { sql, error: String(err) });
      throw err;
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const result = await this.query(sql, params);
    return result;
  }

  async beginTransaction(): Promise<void> {
    this.assertConnected();
    this.txClient = await this.pool!.connect();
    await this.txClient.query('BEGIN');
  }

  async commit(): Promise<void> {
    if (!this.txClient) throw new Error('No active transaction');
    await this.txClient.query('COMMIT');
    this.txClient.release();
    this.txClient = undefined;
  }

  async rollback(): Promise<void> {
    if (!this.txClient) return;
    await this.txClient.query('ROLLBACK');
    this.txClient.release();
    this.txClient = undefined;
  }

  private assertConnected(): void {
    if (!this.connected || !this.pool) {
      throw new Error('PostgresAdapter: not connected');
    }
  }
}
