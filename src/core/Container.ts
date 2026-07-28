/**
 * PAPPYBOT V2 — Dependency Injection Container
 *
 * A lightweight service locator. All shared singletons are registered here
 * and resolved by name. This avoids circular imports and makes testing easy
 * (replace any service with a mock by re-registering under the same key).
 *
 * Usage:
 *   container.register('CacheManager', new CacheManager());
 *   const cache = container.resolve<CacheManager>('CacheManager');
 */

import { logger } from '../logger/Logger';

const log = logger.child('Container');

export class Container {
  private readonly services = new Map<string, unknown>();

  /**
   * Register a service. Overwrites any previous registration.
   */
  register<T>(key: string, instance: T): void {
    this.services.set(key, instance);
    log.trace('Service registered', { key });
  }

  /**
   * Resolve a service by key. Throws if not found.
   */
  resolve<T>(key: string): T {
    const service = this.services.get(key);
    if (service === undefined) {
      throw new Error(`Container: service "${key}" not registered`);
    }
    return service as T;
  }

  /**
   * Try to resolve — returns undefined if not registered.
   */
  tryResolve<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  /**
   * Check if a service is registered.
   */
  has(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * List all registered service keys.
   */
  keys(): string[] {
    return [...this.services.keys()];
  }
}

/** Global DI container — use this across the application */
export const container = new Container();
