/**
 * PAPPYBOT V2 — Session Health Service
 *
 * Computes a health score (0–100) for each session and exposes
 * a full health snapshot for dashboards and monitoring.
 */

import os from 'os';
import type { SessionManager } from '../managers/SessionManager';
import type { HeartbeatMonitor } from './HeartbeatMonitor';
import { socketManager } from '../whatsapp/SocketManager';

export interface SessionHealthSnapshot {
  sessionId: string;
  label?: string;
  status: string;
  phoneNumber?: string;
  platform: string;
  createdAt?: Date;
  connectedAt?: Date;
  lastSeen?: Date;
  healthScore: number;
  memoryUsageMb: number;
  runtimeMs: number;
  reconnectCount: number;
  missedHeartbeats: number;
  socketHealthy: boolean;
  error?: string;
}

export class SessionHealthService {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly heartbeat: HeartbeatMonitor
  ) {}

  getSnapshot(sessionId: string): SessionHealthSnapshot | undefined {
    const session = this.sessionManager.get(sessionId);
    if (!session) return undefined;

    const hb = this.heartbeat.get(sessionId);
    const socketHealth = socketManager.healthCheck().find(h => h.sessionId === sessionId);

    const score = this._computeScore(session.state.status, hb?.missedHeartbeats ?? 0, socketHealth?.connected ?? false, session.state.reconnectAttempts);

    return {
      sessionId,
      label: session.config.label,
      status: session.state.status,
      phoneNumber: session.state.phoneNumber,
      platform: os.platform(),
      createdAt: undefined,
      connectedAt: session.state.connectedAt,
      lastSeen: session.state.lastSeen,
      healthScore: score,
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      runtimeMs: hb?.connectionDurationMs ?? 0,
      reconnectCount: hb?.reconnectCount ?? session.state.reconnectAttempts,
      missedHeartbeats: hb?.missedHeartbeats ?? 0,
      socketHealthy: socketHealth?.connected ?? false,
      error: session.state.error,
    };
  }

  getAllSnapshots(): SessionHealthSnapshot[] {
    return this.sessionManager.getIds()
      .map(id => this.getSnapshot(id))
      .filter((s): s is SessionHealthSnapshot => s !== null);
  }

  private _computeScore(status: string, missedHeartbeats: number, socketHealthy: boolean, reconnects: number): number {
    if (status === 'logged_out' || status === 'banned') return 0;
    if (status === 'error') return 10;
    if (status === 'disconnected') return 20;
    if (status === 'reconnecting') return 40;
    if (status === 'connecting' || status === 'qr_pending') return 60;
    if (status !== 'connected') return 50;

    let score = 100;
    score -= Math.min(missedHeartbeats * 15, 40);
    score -= Math.min(reconnects * 5, 30);
    if (!socketHealthy) score -= 20;
    return Math.max(0, score);
  }
}
