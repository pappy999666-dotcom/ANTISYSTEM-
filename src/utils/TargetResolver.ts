/**
 * PAPPYBOT V2 — Target Resolver
 *
 * Single centralized resolver for all identifier types.
 * Never guess. Never assume. Always validate before use.
 *
 * Resolution priority:
 *   1. Quoted message sender JID
 *   2. First @mention JID
 *   3. Raw argument (phone number or JID)
 *
 * ID types — NEVER mix:
 *   User JID:       2348012345678@s.whatsapp.net
 *   Group JID:      120363xxxxxxxx@g.us
 *   Newsletter:     newsletter@newsletter (or newsletter ID)
 *   LID:            LID only (no @suffix)
 *   Telegram ID:    numeric only
 *   Session ID:     string workspace key
 */

import { normalizeJid, phoneToJid, isGroupJid, isUserJid } from './jid';

export interface ResolvedTarget {
  jid: string;
  phone: string;
  displayName?: string;
}

// ── ID type guards ─────────────────────────────────────────────────────────────

/** Validate a user JID — must end with @s.whatsapp.net */
export function isValidUserJid(jid: string): boolean {
  return /^\d+@s\.whatsapp\.net$/.test(jid);
}

/** Validate a group JID — must end with @g.us */
export function isValidGroupJid(jid: string): boolean {
  return /^\d+-\d+@g\.us$/.test(jid) || /^\d+@g\.us$/.test(jid);
}

/** Validate a phone number string (digits only, 7–15 chars) */
export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/** Detect if a string is already a fully-qualified JID */
export function isJid(raw: string): boolean {
  return raw.includes('@');
}

/** Detect if a string looks like a LID (no @, not purely numeric phone) */
export function isLid(raw: string): boolean {
  return !raw.includes('@') && raw.includes(':');
}

// ── Core resolver ──────────────────────────────────────────────────────────────

/**
 * Resolve a single target from the standard priority chain.
 * Returns undefined if nothing valid could be resolved.
 */
export function resolveTarget(
  mentions: string[],
  quotedSenderJid: string | undefined,
  rawArg: string | undefined,
  displayNameFn?: (jid: string) => string | undefined
): ResolvedTarget | undefined {
  let jid: string | undefined;

  // 1. Quoted sender
  if (quotedSenderJid) {
    const normalized = normalizeJid(quotedSenderJid);
    if (isValidUserJid(normalized)) jid = normalized;
  }

  // 2. First mention
  if (!jid && mentions.length > 0) {
    const normalized = normalizeJid(mentions[0]!);
    if (isValidUserJid(normalized)) jid = normalized;
  }

  // 3. Raw argument
  if (!jid && rawArg) {
    const trimmed = rawArg.trim();
    if (isJid(trimmed)) {
      const normalized = normalizeJid(trimmed);
      if (isValidUserJid(normalized)) jid = normalized;
    } else {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length >= 7 && digits.length <= 15) {
        jid = phoneToJid(digits);
      }
    }
  }

  if (!jid) return undefined;

  return {
    jid,
    phone: jid.split('@')[0]!,
    displayName: displayNameFn?.(jid),
  };
}

/**
 * Resolve multiple targets from a mentions list.
 */
export function resolveTargets(
  mentions: string[],
  displayNameFn?: (jid: string) => string | undefined
): ResolvedTarget[] {
  return mentions
    .map(m => normalizeJid(m))
    .filter(isValidUserJid)
    .map(jid => ({
      jid,
      phone: jid.split('@')[0]!,
      displayName: displayNameFn?.(jid),
    }));
}

/**
 * Normalize any user-provided identifier to a user JID.
 * Throws if the input cannot be resolved to a valid user JID.
 */
export function toUserJid(raw: string): string {
  const trimmed = raw.trim();

  if (isJid(trimmed)) {
    const normalized = normalizeJid(trimmed);
    if (isValidUserJid(normalized)) return normalized;
    throw new Error(`Not a valid user JID: ${trimmed}`);
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15) {
    return phoneToJid(digits);
  }

  throw new Error(`Cannot resolve to user JID: ${trimmed}`);
}

/**
 * Normalize any user-provided identifier to a group JID.
 * Throws if the input cannot be resolved to a valid group JID.
 */
export function toGroupJid(raw: string): string {
  const trimmed = raw.trim();
  if (isValidGroupJid(trimmed)) return trimmed;
  throw new Error(`Not a valid group JID: ${trimmed}`);
}

export { isGroupJid, isUserJid };
