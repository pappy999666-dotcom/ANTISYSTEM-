/**
 * PAPPYBOT V2 — Session Metrics
 *
 * Tracks global pairing and connection statistics.
 */

export interface GlobalSessionMetrics {
  totalSessions: number;
  activeSessions: number;
  failedSessions: number;
  reconnectCount: number;
  pairingAttempts: number;
  pairingSuccesses: number;
  authFailures: number;
  avgConnectionTimeMs: number;
  avgRecoveryTimeMs: number;
}

export class SessionMetrics {
  private _total = 0;
  private _active = 0;
  private _failed = 0;
  private _reconnects = 0;
  private _pairingAttempts = 0;
  private _pairingSuccesses = 0;
  private _authFailures = 0;
  private _connectionTimes: number[] = [];
  private _recoveryTimes: number[] = [];

  incTotal(): void { this._total++; }
  incActive(): void { this._active++; }
  decActive(): void { if (this._active > 0) this._active--; }
  incFailed(): void { this._failed++; }
  incReconnect(): void { this._reconnects++; }
  incPairingAttempt(): void { this._pairingAttempts++; }
  incPairingSuccess(): void { this._pairingSuccesses++; }
  incAuthFailure(): void { this._authFailures++; }

  recordConnectionTime(ms: number): void {
    this._connectionTimes.push(ms);
    if (this._connectionTimes.length > 100) this._connectionTimes.shift();
  }

  recordRecoveryTime(ms: number): void {
    this._recoveryTimes.push(ms);
    if (this._recoveryTimes.length > 100) this._recoveryTimes.shift();
  }

  snapshot(): GlobalSessionMetrics {
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return {
      totalSessions: this._total,
      activeSessions: this._active,
      failedSessions: this._failed,
      reconnectCount: this._reconnects,
      pairingAttempts: this._pairingAttempts,
      pairingSuccesses: this._pairingSuccesses,
      authFailures: this._authFailures,
      avgConnectionTimeMs: avg(this._connectionTimes),
      avgRecoveryTimeMs: avg(this._recoveryTimes),
    };
  }
}

export const sessionMetrics = new SessionMetrics();
