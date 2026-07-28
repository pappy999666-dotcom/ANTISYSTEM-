/**
 * PAPPYBOT V2 — Database Manager
 *
 * Factory + lifecycle manager for the active database adapter.
 * Selects the adapter from config and exposes a single shared instance.
 * Business logic never touches adapters directly — it uses repositories.
 */

import type { DatabaseAdapter, DatabaseConfig, DatabaseDriver } from '../types/Database';
import { SQLiteAdapter } from './adapters/SQLiteAdapter';
import { MongoAdapter } from './adapters/MongoAdapter';
import { PostgresAdapter } from './adapters/PostgresAdapter';
import { logger } from '../logger/Logger';

const log = logger.child('DatabaseManager');

export class DatabaseManager {
  private adapter?: DatabaseAdapter;
  private readonly config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.adapter = this.createAdapter(this.config.driver);
    await this.adapter.connect();
    log.info('Database connected', { driver: this.config.driver });
  }

  async disconnect(): Promise<void> {
    await this.adapter?.disconnect();
    log.info('Database disconnected');
  }

  /**
   * Get the active adapter.
   * Repositories call this to obtain the adapter they need.
   */
  getAdapter(): DatabaseAdapter {
    if (!this.adapter) {
      throw new Error('DatabaseManager: not connected. Call connect() first.');
    }
    return this.adapter;
  }

  getDriver(): DatabaseDriver {
    return this.config.driver;
  }

  isConnected(): boolean {
    return this.adapter?.isConnected() ?? false;
  }

  private createAdapter(driver: DatabaseDriver): DatabaseAdapter {
    switch (driver) {
      case 'sqlite': {
        const path = this.config.sqlite?.path ?? 'storage/database.sqlite';
        return new SQLiteAdapter(path);
      }
      case 'mongodb': {
        if (!this.config.mongodb?.uri) throw new Error('MongoDB URI is required');
        return new MongoAdapter(this.config.mongodb.uri, this.config.mongodb.dbName ?? 'pappybot');
      }
      case 'postgres': {
        const pg = this.config.postgres;
        if (!pg) throw new Error('PostgreSQL config is required');
        return new PostgresAdapter(pg);
      }
      default:
        throw new Error(`Unknown database driver: ${driver as string}`);
    }
  }
}
