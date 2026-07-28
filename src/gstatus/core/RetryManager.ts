/**
 * PAPPYBOT V2 — Retry Manager
 *
 * Determines whether a failed status send should be retried,
 * and calculates the appropriate backoff delay.
 *
 * Permanent failures (auth errors, invalid JID, etc.) are not retried.
 * Transient failures (network, timeout, rate limit) are retried with backoff.
 */

import type { StatusEngineConfig } from '../types/GStatus';
import { logger } from '../../logger/Logger';

const log = logger.child('RetryManager');

/** Error patterns that indicate permanent failure — do not retry */
const PERMANENT_ERROR_PATTERNS = [
  'not-authorized',
  'forbidden',
  'invalid jid',
  'bad request',
  'not found',
  'logged out',
  'connection closed',
  'stream errored',
];

export class RetryManager {
  constructor(private readonly config: StatusEngineConfig) {}

  /**
   * Returns true if the error is transient and the item should be retried.
   */
  shouldRetry(attempts: number, maxRetries: number, error: string): boolean {
    if (attempts >= maxRetries) {
      log.debug('Max retries reached', { attempts, maxRetries });
      return false;
    }

    const errLower = error.toLowerCase();
    const isPermanent = PERMANENT_ERROR_PATTERNS.some(p => errLower.includes(p));
    if (isPermanent) {
      log.debug('Permanent error — not retrying', { error });
      return false;
    }

    return true;
  }

  /**
   * Calculate exponential backoff delay for the given attempt number.
   * attempt=1 → base, attempt=2 → base*2, etc., capped at maxRetryBackoffMs.
   */
  backoffMs(attempt: number): number {
    const delay = Math.min(
      this.config.retryBackoffMs * Math.pow(2, attempt - 1),
      this.config.maxRetryBackoffMs
    );
    // Add ±10% jitter to avoid thundering herd
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.round(delay + jitter);
  }
}
