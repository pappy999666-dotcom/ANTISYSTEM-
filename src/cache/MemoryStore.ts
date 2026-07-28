/**
 * PAPPYBOT V2 — In-Memory Cache Store
 *
 * TTL-aware, automatically cleaned. Future Redis adapter will
 * satisfy the same CacheStore interface.
 */

import type { CacheEntry, CacheStore } from '../types/Cache';
import { nowMs } from '../utils/time';

export class MemoryStore implements CacheStore {
  private readonly store = new Map<string, CacheEntry>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= nowMs()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttl?: number): void {
    const expiresAt = ttl != null ? nowMs() + ttl * 1_000 : null;
    this.store.set(key, { value, expiresAt });
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    this.cleanup(); // expire first
    return [...this.store.keys()];
  }

  cleanup(): number {
    const now = nowMs();
    let removed = 0;
    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.store.delete(key);
        removed++;
      }
    }
    return removed;
  }

  size(): number {
    return this.store.size;
  }
}
