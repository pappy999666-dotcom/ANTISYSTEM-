/**
 * Time/duration utilities.
 */

/**
 * Format a duration in milliseconds to a human-readable string.
 * e.g. 90000 → "1m 30s"
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1_000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Parse a human duration string to milliseconds.
 * Supports: "30s", "5m", "2h", "1d"
 */
export function parseDuration(str: string): number {
  const map: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*([smhd]?)$/i);
  if (!match) throw new Error(`Invalid duration string: "${str}"`);
  const value = parseFloat(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return value * (map[unit] ?? 1_000);
}

/** Return current UTC unix timestamp in milliseconds */
export function nowMs(): number {
  return Date.now();
}

/** Return current UTC unix timestamp in seconds */
export function nowSec(): number {
  return Math.floor(Date.now() / 1_000);
}

/** ISO 8601 timestamp string */
export function isoNow(): string {
  return new Date().toISOString();
}
