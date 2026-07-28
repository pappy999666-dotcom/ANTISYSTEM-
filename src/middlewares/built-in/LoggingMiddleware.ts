/**
 * Built-in request logging middleware.
 * Logs all incoming commands with timing.
 */

import { BaseMiddleware, type MiddlewareContext, type MiddlewareNext } from '../BaseMiddleware';
import { nowMs } from '../../utils/time';

export class LoggingMiddleware extends BaseMiddleware {
  readonly name = 'Logging';
  readonly priority = 1000; // Runs first to measure full pipeline time

  async execute(ctx: MiddlewareContext, next: MiddlewareNext): Promise<void> {
    if (!ctx.message.isCommand) {
      await next();
      return;
    }

    const start = nowMs();
    await next();
    const durationMs = nowMs() - start;

    this.log.info('Command processed', {
      sessionId: ctx.message.sessionId,
      sender: ctx.message.sender.jid,
      chat: ctx.message.chatJid,
      text: ctx.message.text?.slice(0, 80),
      durationMs,
    });
  }
}
