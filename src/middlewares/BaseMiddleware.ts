/**
 * PAPPYBOT V2 — Base Middleware
 *
 * All middleware must extend this class. Middleware runs in the message
 * pipeline between message normalization and command execution.
 */

import type { NormalizedMessage } from '../types/Message';
import type { SessionRuntime } from '../types/Session';
import { logger } from '../logger/Logger';

export interface MiddlewareContext {
  message: NormalizedMessage;
  session: SessionRuntime;
  /** Arbitrary data bag for passing state between middlewares */
  data: Record<string, unknown>;
}

export type MiddlewareNext = () => Promise<void>;

export abstract class BaseMiddleware {
  protected readonly log = logger.child(this.constructor.name);

  /** Unique name for this middleware */
  abstract readonly name: string;

  /**
   * Priority: higher numbers run before lower numbers.
   * Built-in middlewares use 100–900. Plugins should use 0–99 or 901–999.
   */
  readonly priority: number = 0;

  /** Whether this middleware is active */
  enabled = true;

  /**
   * Execute this middleware.
   * Call next() to pass control to the next middleware.
   * Do NOT call next() to short-circuit the pipeline (e.g. blocked user).
   */
  abstract execute(ctx: MiddlewareContext, next: MiddlewareNext): Promise<void>;
}
