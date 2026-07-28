/**
 * PAPPYBOT V2 — Base Listener
 *
 * All application event listeners must extend this class.
 * Provides a uniform registration/unregistration lifecycle.
 */

import type { EventBus } from '../events/EventBus';
import type { EventName, EventPayload } from '../types/Events';
import { logger } from '../logger/Logger';

export abstract class BaseListener {
  protected readonly log = logger.child(this.constructor.name);

  /** Unique name used for deduplication and debugging */
  abstract readonly name: string;

  /** Event this listener handles */
  abstract readonly event: EventName;

  /**
   * Priority: higher numbers run before lower.
   * Override in subclass if ordering matters.
   */
  readonly priority: number = 0;

  private listenerId?: string;

  /** Called when the event fires */
  abstract handle(payload: EventPayload<EventName>): Promise<void>;

  /** Register this listener on the bus. Safe to call multiple times (idempotent). */
  register(bus: EventBus): void {
    if (this.listenerId) {
      this.log.warn('Listener already registered, skipping duplicate', { name: this.name });
      return;
    }
    this.listenerId = bus.on(
      this.event,
      (payload) => this.safeHandle(payload),
      this.priority
    );
    this.log.debug('Listener registered', { name: this.name, event: this.event });
  }

  /** Unregister from the bus */
  unregister(bus: EventBus): void {
    if (this.listenerId) {
      bus.off(this.listenerId);
      this.listenerId = undefined;
      this.log.debug('Listener unregistered', { name: this.name });
    }
  }

  isRegistered(): boolean {
    return this.listenerId !== undefined;
  }

  /** Wraps handle() to isolate errors — one bad listener cannot crash others */
  private async safeHandle(payload: EventPayload<EventName>): Promise<void> {
    try {
      await this.handle(payload);
    } catch (err) {
      this.log.error('Listener handle() threw', {
        name: this.name,
        event: this.event,
        error: String(err),
      });
    }
  }
}
