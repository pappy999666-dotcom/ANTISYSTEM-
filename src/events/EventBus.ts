/**
 * PAPPYBOT V2 — Internal Event Bus
 *
 * Fully typed, async-capable publish/subscribe bus.
 * Modules communicate through events, never through direct imports of each other.
 * Supports priority ordering, one-time listeners, and async listeners.
 */

import { logger } from '../logger/Logger';
import type { EventName, EventPayload, EventListener, PappybotEvents } from '../types/Events';

const log = logger.child('EventBus');

interface RegisteredListener<E extends EventName> {
  id: string;
  listener: EventListener<E>;
  priority: number;
  once: boolean;
}

export class EventBus {
  private readonly listeners: Map<EventName, RegisteredListener<EventName>[]> = new Map();
  private listenerCounter = 0;

  /**
   * Subscribe to an event.
   *
   * @param event    Event name
   * @param listener Callback — may be async
   * @param priority Higher number = called first. Default: 0
   * @returns        Listener ID (use to unsubscribe)
   */
  on<E extends EventName>(
    event: E,
    listener: EventListener<E>,
    priority = 0
  ): string {
    return this.register(event, listener, priority, false);
  }

  /**
   * Subscribe to an event exactly once.
   */
  once<E extends EventName>(event: E, listener: EventListener<E>, priority = 0): string {
    return this.register(event, listener, priority, true);
  }

  /**
   * Unsubscribe a listener by its ID.
   */
  off(listenerId: string): boolean {
    for (const [event, list] of this.listeners) {
      const idx = list.findIndex((l) => l.id === listenerId);
      if (idx !== -1) {
        list.splice(idx, 1);
        log.trace('Listener removed', { listenerId, event });
        return true;
      }
    }
    return false;
  }

  /**
   * Remove all listeners for an event (or all events if no arg).
   */
  removeAll(event?: EventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Emit an event. All registered listeners are called in priority order.
   * Async listeners are awaited sequentially per listener.
   * One error in a listener does NOT stop other listeners.
   */
  async emit<E extends EventName>(event: E, payload: EventPayload<E>): Promise<void> {
    const list = this.listeners.get(event);
    if (!list || list.length === 0) return;

    // Sort by priority descending (higher runs first), then stable insertion order
    const sorted = [...list].sort((a, b) => b.priority - a.priority);
    const toRemove: string[] = [];

    for (const entry of sorted) {
      if (entry.once) toRemove.push(entry.id);
      try {
        await (entry.listener as EventListener<E>)(payload);
      } catch (err) {
        log.error('Listener threw during event', {
          event,
          listenerId: entry.id,
          error: String(err),
        });
      }
    }

    for (const id of toRemove) {
      this.off(id);
    }
  }

  /**
   * Return number of listeners registered for an event.
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  /**
   * Return all event names that have at least one listener.
   */
  eventNames(): EventName[] {
    return [...this.listeners.keys()].filter(
      (e) => (this.listeners.get(e)?.length ?? 0) > 0
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private
  // ─────────────────────────────────────────────────────────────────────────

  private register<E extends EventName>(
    event: E,
    listener: EventListener<E>,
    priority: number,
    once: boolean
  ): string {
    const id = `listener_${++this.listenerCounter}`;
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push({
      id,
      listener: listener as EventListener<EventName>,
      priority,
      once,
    });
    log.trace('Listener registered', { event, id, priority, once });
    return id;
  }
}

/** Singleton event bus — shared across the entire application */
export const eventBus = new EventBus();
