/**
 * Database abstraction types — driver-agnostic interfaces
 * that all repository implementations must satisfy.
 */

export type DatabaseDriver = 'sqlite' | 'mongodb' | 'postgres';

export interface DatabaseConfig {
  driver: DatabaseDriver;
  sqlite?: { path: string };
  mongodb?: { uri: string; dbName: string };
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
}

export interface QueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  /** Last inserted row ID (SQLite/Postgres) */
  lastInsertId?: number | string;
}

export interface DatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}
