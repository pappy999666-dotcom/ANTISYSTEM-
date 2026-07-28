/**
 * PAPPYBOT V2 — Anti Middleware
 *
 * Plugs the AntiEngine into the existing MiddlewareEngine pipeline.
 * Runs after logging/maintenance/rate-limit middlewares.
 * Priority 500 — runs before command execution (priority 0).
 *
 * Register in App.initialize():
 *   middlewareEngine.use(new AntiMiddleware(antiEngine));
 */

import { BaseMiddleware, type MiddlewareContext, type MiddlewareNext } from '../../middlewares/BaseMiddleware';
import type { AntiEngine } from './AntiEngine';
import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';

export class AntiMiddleware extends BaseMiddleware {
  readonly name = 'AntiMiddleware';
  readonly priority = 500;

  constructor(private readonly antiEngine: AntiEngine) {
    super();
  }

  async execute(ctx: MiddlewareContext, next: MiddlewareNext): Promise<void> {
    // Run anti inspection — does not block the pipeline (commands still run after)
    await this.antiEngine.inspect(ctx.message as ExtendedNormalizedMessage);
    await next();
  }
}
