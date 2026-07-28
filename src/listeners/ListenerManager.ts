/**
 * PAPPYBOT V2 — Listener Manager
 *
 * Manages the lifecycle of all BaseListener instances:
 *   - Auto-registration on load
 *   - Deduplication (no double-registration)
 *   - Safe unload / hot-reload
 *   - Error isolation (one listener failure never affects others)
 */

import type { EventBus } from '../events/EventBus';
import { BaseListener } from './BaseListener';
import { logger } from '../logger/Logger';

const log = logger.child('ListenerManager');

export class ListenerManager {
  private readonly registry = new Map<string, BaseListener>();
  private readonly bus: EventBus;

  constructor(bus: EventBus) {
    this.bus = bus;
  }

  /**
   * Register a listener. If a listener with the same name is already registered,
   * it is unloaded first (hot-reload behaviour).
   */
  register(listener: BaseListener): void {
    if (this.registry.has(listener.name)) {
      log.warn('Listener already registered, reloading', { name: listener.name });
      this.unregister(listener.name);
    }
    try {
      listener.register(this.bus);
      this.registry.set(listener.name, listener);
      log.debug('Listener loaded', { name: listener.name, event: listener.event });
    } catch (err) {
      log.error('Failed to register listener', { name: listener.name, error: String(err) });
    }
  }

  /**
   * Register multiple listeners at once.
   */
  registerAll(listeners: BaseListener[]): void {
    for (const l of listeners) {
      this.register(l);
    }
    log.info(`Loaded ${listeners.length} listener(s)`);
  }

  /**
   * Unregister and remove a listener by name.
   */
  unregister(name: string): boolean {
    const listener = this.registry.get(name);
    if (!listener) return false;
    listener.unregister(this.bus);
    this.registry.delete(name);
    log.debug('Listener unloaded', { name });
    return true;
  }

  /**
   * Reload a listener by name (unregister then re-register with same instance).
   */
  reload(name: string): boolean {
    const listener = this.registry.get(name);
    if (!listener) {
      log.warn('Cannot reload unknown listener', { name });
      return false;
    }
    this.unregister(name);
    this.register(listener);
    log.info('Listener reloaded', { name });
    return true;
  }

  /**
   * Unregister all listeners (clean shutdown or full reload).
   */
  unregisterAll(): void {
    for (const [name] of this.registry) {
      this.unregister(name);
    }
    log.info('All listeners unloaded');
  }

  isRegistered(name: string): boolean {
    return this.registry.has(name);
  }

  getRegisteredNames(): string[] {
    return [...this.registry.keys()];
  }

  count(): number {
    return this.registry.size;
  }
}
