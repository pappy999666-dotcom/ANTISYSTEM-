/**
 * PAPPYBOT V2 — Cache Manager
 *
 * Centralized cache facade. Wraps the active CacheStore with
 * namespace support and automatic cleanup scheduling.
 */

import type { CacheStore } from '../types/Cache';
import { MemoryStore } from './MemoryStore';
import { logger } from '../logger/Logger';

const log = logger.child('CacheManager');

export class CacheManager {
  private readonly store: CacheStore;
  private cleanupTimer?: ReturnType<typeof setInterval>;
  private readonly defaultTtl: number;

  constructor(store?: CacheStore, defaultTtl = 300, cleanupIntervalSec = 60) {
    this.store = store ?? new MemoryStore();
    this.defaultTtl = defaultTtl;
    this.startCleanup(cleanupIntervalSec);
  }

  /**
   * Get a value. Returns undefined on miss or expiry.
   */
  get<T>(key: string): T | undefined {
    return this.store.get<T>(key);
  }

  /**
   * Set a value with optional TTL (seconds). Uses defaultTtl if not specified.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    this.store.set(key, value, ttl ?? this.defaultTtl);
  }

  /**
   * Set a value that never expires.
   */
  setPermanent<T>(key: string, value: T): void {
    this.store.set(key, value, undefined);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  /**
   * Get or compute: returns cached value, or calls factory and caches result.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Clear all keys matching a prefix.
   */
  clearPrefix(prefix: string): number {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size();
  }

  /**
   * Create a namespaced sub-cache. All keys are prefixed with namespace + ':'.
   * Useful for session-scoped caches that should not collide with each other.
   */
  namespace(ns: string): NamespacedCache {
    return new NamespacedCache(this, ns);
  }

  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private startCleanup(intervalSec: number): void {
    this.cleanupTimer = setInterval(() => {
      const removed = this.store.cleanup();
      if (removed > 0) {
        log.trace('Cache cleanup', { removed });
      }
    }, intervalSec * 1_000);

    // Allow process to exit even if timer is running
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }
}

/** Thin wrapper that prefixes all keys with a namespace */
export class NamespacedCache {
  constructor(
    private readonly cache: CacheManager,
    private readonly ns: string
  ) {}

  private k(key: string): string {
    return `${this.ns}:${key}`;
  }

  get<T>(key: string): T | undefined {
    return this.cache.get<T>(this.k(key));
  }

  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(this.k(key), value, ttl);
  }

  delete(key: string): boolean {
    return this.cache.delete(this.k(key));
  }

  has(key: string): boolean {
    return this.cache.has(this.k(key));
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    return this.cache.getOrSet<T>(this.k(key), factory, ttl);
  }

  clearAll(): number {
    return this.cache.clearPrefix(`${this.ns}:`);
  }
}
