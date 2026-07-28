/**
 * Cache layer types — TTL-aware key-value store interface.
 */

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt: number | null;
}

export interface CacheStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl?: number): void;
  delete(key: string): boolean;
  has(key: string): boolean;
  clear(): void;
  keys(): string[];
  /** Remove expired entries */
  cleanup(): number;
  size(): number;
}
