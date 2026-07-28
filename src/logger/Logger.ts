/**
 * PAPPYBOT V2 — Centralized Logger
 *
 * Built on pino for high-performance structured logging.
 * Supports: INFO, SUCCESS, WARNING, ERROR, DEBUG, TRACE, PERF
 * Every module receives a child logger with a module-scoped name.
 */

import pino from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PinoInstance = pino.Logger<any>;

export interface LoggerConfig {
  level: LogLevel;
  prettyPrint: boolean;
  logToFile: boolean;
  logDir: string;
}

/**
 * Wrapper around a pino instance that adds SUCCESS and PERF
 * convenience methods and a module-scoped child factory.
 */
export class Logger {
  private readonly pino: PinoInstance;

  constructor(pinoInstance?: PinoInstance, config?: Partial<LoggerConfig>) {
    if (pinoInstance) {
      this.pino = pinoInstance;
      return;
    }

    const level: string =
      config?.level ?? (process.env['LOG_LEVEL'] as LogLevel) ?? 'info';
    const pretty =
      config?.prettyPrint ?? process.env['NODE_ENV'] !== 'production';

    const transport = pretty
      ? ({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        } as const)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.pino = pino({ level, transport } as any);
  }

  /** Standard log levels */
  trace(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.trace(ctx ?? {}, msg);
  }

  debug(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.debug(ctx ?? {}, msg);
  }

  info(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.info(ctx ?? {}, msg);
  }

  warn(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.warn(ctx ?? {}, msg);
  }

  error(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.error(ctx ?? {}, msg);
  }

  fatal(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.fatal(ctx ?? {}, msg);
  }

  /** Convenience: alias for info with a 'SUCCESS' prefix */
  success(msg: string, ctx?: Record<string, unknown>): void {
    this.pino.info({ ...ctx, level_label: 'SUCCESS' }, `✓ ${msg}`);
  }

  /**
   * Performance log — record operation duration.
   * @param label  Short description of the operation
   * @param ms     Duration in milliseconds
   */
  perf(label: string, ms: number, ctx?: Record<string, unknown>): void {
    this.pino.debug({ durationMs: ms, ...ctx }, `PERF: ${label}`);
  }

  /**
   * Create a child logger with a module name bound to every log line.
   * Use this in every module: `const log = rootLogger.child('SessionManager')`
   */
  child(module: string): Logger {
    return new Logger(this.pino.child({ module }));
  }

  /** Dynamically change the log level at runtime without restart */
  setLevel(level: LogLevel): void {
    this.pino.level = level;
  }

  getLevel(): string {
    return this.pino.level;
  }
}

/** Singleton root logger — import this everywhere */
export const logger = new Logger();
