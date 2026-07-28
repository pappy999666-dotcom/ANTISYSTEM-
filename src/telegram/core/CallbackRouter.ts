/**
 * PAPPYBOT V2 — Callback Router
 *
 * Telegram callback_data is limited to 64 bytes.
 * We encode as: "action|payload|page" and decode back.
 */

import type { CallbackData } from '../types/Telegram';

const SEP = '|';

export function encodeCallback(data: CallbackData): string {
  const parts = [data.action, data.payload ?? '', String(data.page ?? '')];
  const encoded = parts.join(SEP);
  // Truncate to 64 bytes safely
  return encoded.slice(0, 64);
}

export function decodeCallback(raw: string): CallbackData {
  const parts = raw.split(SEP);
  return {
    action: (parts[0] ?? 'noop') as CallbackData['action'],
    payload: parts[1] || undefined,
    page: parts[2] ? Number(parts[2]) : undefined,
  };
}

/** Shorthand builder */
export function cb(action: string, payload?: string, page?: number): string {
  return encodeCallback({ action, payload, page });
}
