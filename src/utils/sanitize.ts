/**
 * Input sanitization utilities.
 * All external input (user commands, filenames, paths) must pass through here.
 */

import path from 'path';
import { MAX_INPUT_LENGTH } from '../constants';

/**
 * Truncate and strip null bytes from user input.
 * Throws if input is not a string.
 */
export function sanitizeInput(input: unknown, maxLength = MAX_INPUT_LENGTH): string {
  if (typeof input !== 'string') {
    throw new TypeError(`Expected string input, got ${typeof input}`);
  }
  // Remove null bytes and control characters (except newlines/tabs)
  const cleaned = input
    .replace(/\0/g, '')
    .replace(/[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
  return cleaned.slice(0, maxLength);
}

/**
 * Sanitize a filename to prevent path traversal.
 * Returns only the basename, replacing dangerous characters.
 */
export function sanitizeFilename(filename: string): string {
  // Extract just the basename — prevents directory traversal
  const base = path.basename(filename);
  // Replace characters not safe for filenames
  return base.replace(/[^\w\s\-.]/g, '_').trim() || 'unnamed';
}

/**
 * Validate that a resolved path stays within a given root directory.
 * Throws on path traversal attempts.
 */
export function assertSafePath(rootDir: string, targetPath: string): void {
  const resolved = path.resolve(targetPath);
  const root = path.resolve(rootDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal attempt detected: ${targetPath}`);
  }
}

/**
 * Sanitize a WhatsApp JID to prevent injection into queries.
 * Accepts only valid JID characters.
 */
export function sanitizeJid(jid: string): string {
  return jid.replace(/[^\w@.:+\-]/g, '');
}

/**
 * Strip HTML tags from a string.
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}
