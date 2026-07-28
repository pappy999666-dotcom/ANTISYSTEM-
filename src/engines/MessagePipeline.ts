/**
 * PAPPYBOT V2 — Message Pipeline
 *
 * Every incoming WhatsApp message flows through this pipeline:
 *
 *  Receive → Normalize → Validate → Middleware → Permission Check
 *      → Event Emit → Command Detection → Service Execution
 *      → Response Builder → Send
 *
 * Future anti-abuse, AI, and group management modules plug in
 * at the middleware or event layers — not by modifying this file.
 */

import type { NormalizedMessage } from '../types/Message';
import type { SessionRuntime } from '../types/Session';
import type { EventBus } from '../events/EventBus';
import type { MiddlewareEngine } from '../middlewares/MiddlewareEngine';
import type { CommandEngine } from './CommandEngine';
import type { MiddlewareContext } from '../middlewares/BaseMiddleware';
import { logger } from '../logger/Logger';
import { sanitizeInput } from '../utils/sanitize';
import { MAX_INPUT_LENGTH } from '../constants';

const log = logger.child('MessagePipeline');

export class MessagePipeline {
  private readonly bus: EventBus;
  private readonly middleware: MiddlewareEngine;
  private readonly commands: CommandEngine;

  constructor(bus: EventBus, middleware: MiddlewareEngine, commands: CommandEngine) {
    this.bus = bus;
    this.middleware = middleware;
    this.commands = commands;
  }

  /**
   * Process a single normalized message through the full pipeline.
   */
  async process(message: NormalizedMessage, session: SessionRuntime): Promise<void> {
    // ── 1. Validate ───────────────────────────────────────────────────────
    if (!this.validate(message)) {
      log.trace('Message failed validation, discarded', { id: message.id });
      return;
    }

    // ── 2. Sanitize text input ────────────────────────────────────────────
    if (message.text) {
      try {
        message.text = sanitizeInput(message.text, MAX_INPUT_LENGTH);
      } catch {
        log.warn('Message text failed sanitization', { id: message.id });
        return;
      }
    }

    // ── 3. Middleware chain ───────────────────────────────────────────────
    const ctx: MiddlewareContext = {
      message,
      session,
      data: {},
    };
    const passed = await this.middleware.run(ctx);
    if (!passed) {
      log.trace('Message blocked by middleware', { id: message.id });
      return;
    }

    // ── 4. Emit message:received event ────────────────────────────────────
    await this.bus.emit('message:received', { message });

    // ── 5. Command detection & execution ──────────────────────────────────
    if (message.isCommand) {
      await this.commands.handle(message, session);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private validate(message: NormalizedMessage): boolean {
    if (!message.id) return false;
    if (!message.sessionId) return false;
    if (!message.chatJid) return false;
    if (!message.sender?.jid) return false;
    // Ignore messages from self (prevent echo loops)
    if (message.sender.isBot) return false;
    return true;
  }
}
