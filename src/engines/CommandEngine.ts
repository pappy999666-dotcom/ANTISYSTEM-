/**
 * PAPPYBOT V2 — Command Engine
 *
 * Handles command registration, alias resolution, cooldown enforcement,
 * argument parsing, permission checks, and execution.
 * Business logic lives in services — commands are only thin controllers.
 */

import type {
  CommandHandler,
  CommandMeta,
  CommandContext,
  ParsedArgs,
  CommandRegistryEntry,
} from '../types/Command';
import type { NormalizedMessage } from '../types/Message';
import type { SessionRuntime } from '../types/Session';
import type { EventBus } from '../events/EventBus';
import type { CacheManager } from '../cache/CacheManager';
import type { PermissionManager } from '../permissions/PermissionManager';
import { ROLES } from '../types/Permissions';
import { logger } from '../logger/Logger';
import { DEFAULT_COOLDOWN_MS, DEFAULT_PREFIX } from '../constants';
import { nowMs } from '../utils/time';

const log = logger.child('CommandEngine');

export class CommandEngine {
  /** Primary name → handler */
  private readonly registry = new Map<string, CommandRegistryEntry>();
  /** Alias → primary name */
  private readonly aliases = new Map<string, string>();

  private readonly bus: EventBus;
  private readonly cache: CacheManager;
  private readonly permissions: PermissionManager;
  private readonly prefix: string;

  constructor(
    bus: EventBus,
    cache: CacheManager,
    permissions: PermissionManager,
    prefix = DEFAULT_PREFIX
  ) {
    this.bus = bus;
    this.cache = cache;
    this.permissions = permissions;
    this.prefix = prefix;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Register a command handler. Overwrites an existing registration with the same name.
   */
  register(handler: CommandHandler): void {
    const { name, aliases = [] } = handler.meta;
    this.registry.set(name, { handler, registeredName: name });

    for (const alias of aliases) {
      if (this.aliases.has(alias)) {
        log.warn('Alias conflicts with existing registration', { alias, command: name });
      }
      this.aliases.set(alias, name);
    }

    log.debug('Command registered', { name, aliases });
  }

  /**
   * Register multiple commands at once.
   */
  registerAll(handlers: CommandHandler[]): void {
    for (const h of handlers) {
      this.register(h);
    }
    log.info(`Registered ${handlers.length} command(s)`);
  }

  /**
   * Unregister a command and its aliases.
   */
  unregister(name: string): boolean {
    const entry = this.registry.get(name);
    if (!entry) return false;
    this.registry.delete(name);
    for (const [alias, target] of this.aliases) {
      if (target === name) this.aliases.delete(alias);
    }
    log.debug('Command unregistered', { name });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Execution
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Attempt to handle an incoming normalized message as a command.
   * Returns true if a command was dispatched.
   */
  async handle(message: NormalizedMessage, session: SessionRuntime): Promise<boolean> {
    const text = message.text?.trim();
    if (!text?.startsWith(this.prefix)) return false;

    const withoutPrefix = text.slice(this.prefix.length);
    const [rawName, ...rest] = withoutPrefix.split(/\s+/);
    const commandName = rawName?.toLowerCase();
    if (!commandName) return false;

    const primaryName = this.aliases.get(commandName) ?? commandName;
    const entry = this.registry.get(primaryName);
    if (!entry) return false;

    const { handler } = entry;
    const meta = handler.meta;

    if (meta.disabled) {
      log.debug('Command is disabled', { name: primaryName });
      return true; // consumed, just silently disabled
    }

    // ── Context checks ──────────────────────────────────────────────────
    if (meta.groupOnly && message.chatType !== 'group') return false;
    if (meta.privateOnly && message.chatType !== 'private') return false;

    // ── Permission check ─────────────────────────────────────────────────
    const requiredRole = meta.requiredRole ?? ROLES.USER;
    const hasPermission = await this.permissions.hasRole(
      message.sender.jid,
      requiredRole as typeof ROLES[keyof typeof ROLES],
      session.config.id
    );
    if (!hasPermission) {
      log.debug('Command denied: insufficient permissions', {
        user: message.sender.jid,
        command: primaryName,
        required: requiredRole,
      });
      return true; // consumed, permission denied
    }

    // ── Cooldown check ───────────────────────────────────────────────────
    const cooldownMs = meta.cooldown ?? DEFAULT_COOLDOWN_MS;
    const cooldownKey = `cooldown:${session.config.id}:${message.sender.jid}:${primaryName}`;
    const lastUsed = this.cache.get<number>(cooldownKey);
    if (lastUsed !== undefined) {
      const remaining = cooldownMs - (nowMs() - lastUsed);
      if (remaining > 0) {
        await this.bus.emit('command:cooldown', {
          commandName: primaryName,
          sessionId: session.config.id,
          senderJid: message.sender.jid,
          remainingMs: remaining,
        });
        return true;
      }
    }

    // ── Build context & args ─────────────────────────────────────────────
    const rawArgs = rest.join(' ');
    const args = this.parseArgs(rawArgs);

    // Placeholder reply/send; will be replaced by ResponseEngine wiring
    const replyFn = async (text: string) => {
      log.debug('[reply stub]', { text: text.slice(0, 80) });
    };

    const ctx: CommandContext = {
      message,
      session,
      args,
      reply: replyFn,
      send: replyFn,
    };

    // ── Execute ──────────────────────────────────────────────────────────
    const start = nowMs();
    try {
      await handler.execute(ctx);
      this.cache.set(cooldownKey, nowMs(), Math.ceil(cooldownMs / 1_000));
      const durationMs = nowMs() - start;
      await this.bus.emit('command:executed', {
        commandName: primaryName,
        sessionId: session.config.id,
        senderJid: message.sender.jid,
        success: true,
        durationMs,
      });
    } catch (err) {
      await this.bus.emit('command:error', {
        commandName: primaryName,
        sessionId: session.config.id,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      log.error('Command execution failed', { name: primaryName, error: String(err) });
    }

    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Argument parsing
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Parse the raw argument string into structured ParsedArgs.
   * Preserves quoted strings as single tokens (e.g. "hello world" → one token).
   */
  parseArgs(raw: string): ParsedArgs {
    const tokens: string[] = [];
    const flags: Record<string, string | boolean> = {};

    // Tokenize respecting quoted strings
    const regex = /--?([\w-]+)(?:=("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s]*))?|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|(\S+)/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(raw)) !== null) {
      if (match[1] !== undefined) {
        // Flag: --key or --key=value or -k
        flags[match[1]] = match[2] !== undefined ? match[2].replace(/^['"]|['"]$/g, '') : true;
      } else {
        // Regular token (quoted or unquoted)
        tokens.push(match[3] ?? match[4] ?? match[5] ?? '');
      }
    }

    return {
      raw,
      argv: raw.split(/\s+/).filter(Boolean),
      tokens,
      flags,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Introspection
  // ─────────────────────────────────────────────────────────────────────────

  getRegistered(): CommandMeta[] {
    return [...this.registry.values()].map((e) => e.handler.meta);
  }

  resolve(name: string): CommandHandler | undefined {
    const primary = this.aliases.get(name) ?? name;
    return this.registry.get(primary)?.handler;
  }

  has(name: string): boolean {
    return this.registry.has(name) || this.aliases.has(name);
  }

  count(): number {
    return this.registry.size;
  }
}
