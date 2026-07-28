/**
 * PAPPYBOT V2 — Middleware Engine
 *
 * Chains middleware in priority order. A middleware that does not call
 * next() short-circuits the chain (pipeline stopped).
 */

import type { BaseMiddleware, MiddlewareContext } from './BaseMiddleware';
import { logger } from '../logger/Logger';

const log = logger.child('MiddlewareEngine');

export class MiddlewareEngine {
  private readonly middlewares: BaseMiddleware[] = [];

  /**
   * Register a middleware. Keeps the list sorted by priority (descending).
   */
  use(middleware: BaseMiddleware): void {
    if (this.middlewares.find((m) => m.name === middleware.name)) {
      log.warn('Middleware already registered', { name: middleware.name });
      return;
    }
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => b.priority - a.priority);
    log.debug('Middleware registered', { name: middleware.name, priority: middleware.priority });
  }

  /**
   * Remove a registered middleware by name.
   */
  remove(name: string): boolean {
    const idx = this.middlewares.findIndex((m) => m.name === name);
    if (idx === -1) return false;
    this.middlewares.splice(idx, 1);
    log.debug('Middleware removed', { name });
    return true;
  }

  /**
   * Run all enabled middlewares against the given context.
   * Returns true if the full chain ran, false if it was short-circuited.
   */
  async run(ctx: MiddlewareContext): Promise<boolean> {
    const enabled = this.middlewares.filter((m) => m.enabled);
    let chainCompleted = false;

    const createNext = (index: number): (() => Promise<void>) => {
      return async () => {
        if (index >= enabled.length) {
          chainCompleted = true;
          return;
        }
        const mw = enabled[index]!;
        try {
          await mw.execute(ctx, createNext(index + 1));
        } catch (err) {
          log.error('Middleware threw', { name: mw.name, error: String(err) });
          // Error in middleware stops the chain but does not crash the app
        }
      };
    };

    await createNext(0)();
    return chainCompleted;
  }

  getRegistered(): string[] {
    return this.middlewares.map((m) => m.name);
  }

  count(): number {
    return this.middlewares.length;
  }
}
