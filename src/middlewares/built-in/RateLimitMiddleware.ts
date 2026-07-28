/**
 * Built-in rate limiting middleware.
 * Tracks per-sender command counts within a sliding window.
 */

import { BaseMiddleware, type MiddlewareContext, type MiddlewareNext } from '../BaseMiddleware';
import type { CacheManager } from '../../cache/CacheManager';

export class RateLimitMiddleware extends BaseMiddleware {
  readonly name = 'RateLimit';
  readonly priority = 800;

  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly cache: CacheManager;

  constructor(cache: CacheManager, windowMs = 60_000, maxRequests = 30) {
    super();
    this.cache = cache;
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  async execute(ctx: MiddlewareContext, next: MiddlewareNext): Promise<void> {
    if (!ctx.message.isCommand) {
      await next();
      return;
    }

    const key = `ratelimit:${ctx.session.config.id}:${ctx.message.sender.jid}`;
    const current = this.cache.get<number>(key) ?? 0;

    if (current >= this.maxRequests) {
      this.log.warn('Rate limit exceeded', {
        sender: ctx.message.sender.jid,
        count: current,
        max: this.maxRequests,
      });
      // Short-circuit: do not call next()
      return;
    }

    this.cache.set(key, current + 1, Math.ceil(this.windowMs / 1000));
    await next();
  }
}
