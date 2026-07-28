/**
 * PAPPYBOT V2 — Cleanup Engine
 *
 * Atomically removes all resources associated with a session:
 * socket, auth files, cache, scheduler jobs, temp media, metadata.
 *
 * Called on both logout (keeps config) and delete (removes everything).
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../logger/Logger';
import type { SessionManager } from '../managers/SessionManager';
import type { CacheManager } from '../cache/CacheManager';
import type { SchedulerService } from '../schedulers/SchedulerService';
import type { EventBus } from '../events/EventBus';
import { socketManager } from '../whatsapp/SocketManager';
import type { HeartbeatMonitor } from './HeartbeatMonitor';
import { sessionMetrics } from './SessionMetrics';

const log = logger.child('CleanupEngine');

export interface CleanupOptions {
  /** Remove auth files from disk (true for delete, false for logout-only) */
  deleteAuth?: boolean;
  /** Remove session storage directory entirely */
  deleteStorage?: boolean;
  /** Emit events after cleanup */
  notify?: boolean;
}

export class CleanupEngine {
  constructor(
    private readonly sessionManager: SessionManager,
    private readonly cache: CacheManager,
    private readonly scheduler: SchedulerService,
    private readonly heartbeat: HeartbeatMonitor,
    private readonly bus: EventBus,
    private readonly storagePath: string
  ) {}

  /**
   * Logout: disconnect socket, clear runtime, preserve auth for re-pair.
   */
  async logout(sessionId: string): Promise<void> {
    log.info('Logging out session', { sessionId });
    await this._cleanup(sessionId, { deleteAuth: false, deleteStorage: false, notify: true });
    await this.bus.emit('session:logged_out', { sessionId });
  }

  /**
   * Delete: atomically remove everything — auth, storage, cache, jobs, heartbeat.
   */
  async delete(sessionId: string): Promise<void> {
    log.info('Deleting session', { sessionId });
    await this._cleanup(sessionId, { deleteAuth: true, deleteStorage: true, notify: true });
    await this.bus.emit('session:deleted', { sessionId });
  }

  private async _cleanup(sessionId: string, opts: CleanupOptions): Promise<void> {
    // 1. Disconnect socket
    socketManager.removeSocket(sessionId, true);

    // 2. Cancel scheduler jobs for this session
    this._cancelSchedulerJobs(sessionId);

    // 3. Clear cache namespace
    const session = this.sessionManager.get(sessionId);
    if (session) {
      this.cache.clearPrefix(session.cacheNamespace);
    }

    // 4. Unregister heartbeat
    this.heartbeat.unregister(sessionId);

    // 5. Remove auth files
    if (opts.deleteAuth) {
      const authPath = path.join(this.storagePath, sessionId);
      if (fs.existsSync(authPath)) {
        fs.rmSync(authPath, { recursive: true, force: true });
        log.debug('Auth files deleted', { sessionId, authPath });
      }
    }

    // 6. Remove storage directory (media-tmp, logs, etc.)
    if (opts.deleteStorage) {
      const storagePath = path.join(this.storagePath, sessionId);
      if (fs.existsSync(storagePath)) {
        fs.rmSync(storagePath, { recursive: true, force: true });
        log.debug('Session storage deleted', { sessionId });
      }
    }

    // 7. Remove from session registry
    this.sessionManager.remove(sessionId);
    sessionMetrics.decActive();

    log.info('Session cleanup complete', { sessionId });
  }

  private _cancelSchedulerJobs(sessionId: string): void {
    try {
      const prefix = `${sessionId}:`;
      const jobs = this.scheduler.listJobs();
      for (const job of jobs) {
        if (job.id.startsWith(prefix)) {
          this.scheduler.cancel(job.id);
        }
      }
    } catch {
      // Safe to ignore
    }
  }
}
