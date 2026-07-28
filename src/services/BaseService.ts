/**
 * PAPPYBOT V2 — Base Service
 *
 * All application services extend this class.
 * Services are where business logic lives — not in commands or listeners.
 */

import { logger } from '../logger/Logger';

export abstract class BaseService {
  protected readonly log = logger.child(this.constructor.name);

  /**
   * Optional lifecycle hook — called during application startup.
   * Override to initialize resources (open connections, seed data, etc.).
   */
  async initialize(): Promise<void> {
    // Default: no-op
  }

  /**
   * Optional lifecycle hook — called during graceful shutdown.
   * Override to release resources.
   */
  async shutdown(): Promise<void> {
    // Default: no-op
  }
}
