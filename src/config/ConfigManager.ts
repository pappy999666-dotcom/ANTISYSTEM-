/**
 * PAPPYBOT V2 — Centralized Configuration Manager
 *
 * Priority (highest wins):
 *   1. Environment variables
 *   2. JSON config file  (config/config.json)
 *   3. Built-in defaults
 *
 * Supports hot-reload of the JSON file without restarting.
 * Emits 'config:changed' events through the EventBus.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../logger/Logger';
import { safeJsonParse, deepClone } from '../utils/helpers';

const log = logger.child('ConfigManager');

type ConfigValue = string | number | boolean | null | ConfigValue[] | { [k: string]: ConfigValue };

export type AppConfig = Record<string, ConfigValue>;

export class ConfigManager {
  private config: AppConfig = {};
  private readonly configPath: string;
  private readonly changeListeners: Array<(key: string, oldVal: ConfigValue, newVal: ConfigValue) => void> = [];

  constructor(configPath = 'config/config.json') {
    this.configPath = path.resolve(configPath);
  }

  /** Load configuration from file + env. Must be called once at startup. */
  load(): void {
    this.config = this.loadFromFile();
    this.applyEnvOverrides();
    log.info('Configuration loaded', { path: this.configPath });
  }

  /** Re-read config file and apply env overrides. Emits change events. */
  reload(): void {
    const previous = deepClone(this.config);
    this.config = this.loadFromFile();
    this.applyEnvOverrides();
    this.diffAndNotify(previous, this.config);
    log.info('Configuration reloaded');
  }

  /**
   * Get a config value by dot-notation key.
   * Returns undefined if the key does not exist.
   *
   * @example config.get('database.driver')  // → 'sqlite'
   */
  get<T extends ConfigValue>(key: string): T | undefined {
    const parts = key.split('.');
    let current: ConfigValue = this.config;
    for (const part of parts) {
      if (current === null || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      current = (current as Record<string, ConfigValue>)[part];
      if (current === undefined) return undefined;
    }
    return current as T;
  }

  /**
   * Get a config value, throwing if missing.
   */
  require<T extends ConfigValue>(key: string): T {
    const value = this.get<T>(key);
    if (value === undefined) {
      throw new Error(`Required config key "${key}" is not set`);
    }
    return value;
  }

  /**
   * Override a config value at runtime.
   * Changes are not persisted to disk — use database overrides for persistence.
   */
  set(key: string, value: ConfigValue): void {
    const oldValue = this.get(key);
    const parts = key.split('.');
    let current = this.config;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as AppConfig;
    }
    current[parts[parts.length - 1]!] = value;
    this.notifyChange(key, oldValue ?? null, value);
  }

  /** Register a listener for config value changes */
  onChange(cb: (key: string, oldVal: ConfigValue, newVal: ConfigValue) => void): void {
    this.changeListeners.push(cb);
  }

  /** Return the full config snapshot (read-only deep clone) */
  getAll(): AppConfig {
    return deepClone(this.config);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private loadFromFile(): AppConfig {
    try {
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      return safeJsonParse<AppConfig>(raw) ?? {};
    } catch (err) {
      log.warn('Could not read config file, using defaults', {
        path: this.configPath,
        error: String(err),
      });
      return {};
    }
  }

  private applyEnvOverrides(): void {
    // Map of ENV_VAR → dot-notation config key
    const envMap: Record<string, string> = {
      NODE_ENV: 'app.env',
      APP_DEBUG: 'app.debug',
      LOG_LEVEL: 'logger.level',
      DB_DRIVER: 'database.driver',
      DB_SQLITE_PATH: 'database.sqlite.path',
      DB_MONGO_URI: 'database.mongodb.uri',
      DB_MONGO_NAME: 'database.mongodb.dbName',
      DB_PG_HOST: 'database.postgres.host',
      DB_PG_PORT: 'database.postgres.port',
      DB_PG_DATABASE: 'database.postgres.database',
      DB_PG_USER: 'database.postgres.user',
      DB_PG_PASSWORD: 'database.postgres.password',
      CACHE_DRIVER: 'cache.driver',
      CMD_PREFIX: 'commands.prefix',
      SESSIONS_PATH: 'sessions.storagePath',
      GLOBAL_OWNER_NUMBER: 'security.globalOwner',
    };

    for (const [envKey, configKey] of Object.entries(envMap)) {
      const value = process.env[envKey];
      if (value !== undefined) {
        this.set(configKey, value);
      }
    }
  }

  private diffAndNotify(prev: AppConfig, next: AppConfig, prefix = ''): void {
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const oldVal = prev[key] ?? null;
      const newVal = next[key] ?? null;
      if (typeof oldVal === 'object' && typeof newVal === 'object' && oldVal && newVal && !Array.isArray(oldVal)) {
        this.diffAndNotify(oldVal as AppConfig, newVal as AppConfig, fullKey);
      } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        this.notifyChange(fullKey, oldVal, newVal);
      }
    }
  }

  private notifyChange(key: string, oldVal: ConfigValue, newVal: ConfigValue): void {
    for (const cb of this.changeListeners) {
      try {
        cb(key, oldVal, newVal);
      } catch (err) {
        log.error('Config change listener threw', { key, error: String(err) });
      }
    }
  }
}

/** Singleton config manager */
export const config = new ConfigManager();
