/**
 * Command engine types — defines the shape of registered commands,
 * parsed arguments, and execution context.
 */

import type { NormalizedMessage } from './Message';
import type { SessionRuntime } from './Session';

export type CommandCategory =
  | 'admin'
  | 'group'
  | 'user'
  | 'owner'
  | 'utility'
  | 'ai'
  | 'fun'
  | 'info'
  | 'moderation'
  | string;

export interface CommandMeta {
  /** Primary command name */
  name: string;
  /** Short one-line description */
  description: string;
  /** Detailed usage instructions */
  usage?: string;
  /** Example usages shown in help */
  examples?: string[];
  category: CommandCategory;
  aliases?: string[];
  /** Minimum permission role required */
  requiredRole?: string;
  /** Cooldown in milliseconds (overrides default) */
  cooldown?: number;
  /** Whether command is disabled globally */
  disabled?: boolean;
  /** Whether to show in help listing */
  hidden?: boolean;
  /** Group-only restriction */
  groupOnly?: boolean;
  /** Private chat only restriction */
  privateOnly?: boolean;
  /** Whether command requires owner to be queried */
  ownerOnly?: boolean;
}

export interface ParsedArgs {
  /** Raw argument string after command name */
  raw: string;
  /** Array of whitespace-split tokens */
  argv: string[];
  /** Quoted strings preserved as single tokens */
  tokens: string[];
  /** Named flags like --key=value or --flag */
  flags: Record<string, string | boolean>;
}

export interface CommandContext {
  message: NormalizedMessage;
  session: SessionRuntime;
  args: ParsedArgs;
  /** Reply helper — sends a message quoted to the triggering message */
  reply: (text: string) => Promise<void>;
  /** Send helper — sends to same chat without quoting */
  send: (text: string) => Promise<void>;
}

export interface CommandHandler {
  meta: CommandMeta;
  execute(ctx: CommandContext): Promise<void>;
}

export interface CommandRegistryEntry {
  handler: CommandHandler;
  /** Resolved from aliases map */
  registeredName: string;
}
