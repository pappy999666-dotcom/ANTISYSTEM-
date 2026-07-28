/**
 * PAPPYBOT V2 — Session Manager
 *
 * Each WhatsApp account is an isolated "session" workspace.
 * The Session Manager creates, tracks, and tears down sessions,
 * ensuring no cross-session interference.
 */

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { SessionConfig, SessionRuntime, SessionState } from '../types/Session';
import type { EventBus } from '../events/EventBus';
import type { CacheManager } from '../cache/CacheManager';
import { logger } from '../logger/Logger';
import { SESSIONS_PATH, SESSION_MAX_RECONNECT_ATTEMPTS } from '../constants';

const log = logger.child('SessionManager');

export class SessionManager {
  private readonly sessions = new Map<string, SessionRuntime>();
  private readonly bus: EventBus;
  private readonly cache: CacheManager;
  private readonly storagePath: string;
  private readonly maxSessions: number;

  constructor(bus: EventBus, cache: CacheManager, storagePath = SESSIONS_PATH, maxSessions = 10) {
    this.bus = bus;
    this.cache = cache;
    this.storagePath = path.resolve(storagePath);
    this.maxSessions = maxSessions;
    fs.mkdirSync(this.storagePath, { recursive: true });
  }

  /**
   * Create and register a new session workspace.
   * Does NOT start the WhatsApp connection — call WhatsAppClient.start(sessionId) for that.
   */
  create(config: Omit<SessionConfig, 'id'> & { id?: string }): SessionRuntime {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(`Session limit reached (max: ${this.maxSessions})`);
    }

    const id = config.id ?? uuidv4();
    if (this.sessions.has(id)) {
      throw new Error(`Session "${id}" already exists`);
    }

    // Duplicate label check
    if (config.label) {
      const duplicate = [...this.sessions.values()].find(s => s.config.label === config.label);
      if (duplicate) {
        throw new Error(`Session label "${config.label}" already in use by session "${duplicate.config.id}"`);
      }
    }

    const fullConfig: SessionConfig = { ...config, id };
    const state: SessionState = {
      id,
      status: 'initializing',
      reconnectAttempts: 0,
    };

    const runtime: SessionRuntime = {
      config: fullConfig,
      state,
      dbNamespace: `session_${id}`,
      cacheNamespace: `session:${id}`,
    };

    this.sessions.set(id, runtime);

    // Ensure storage directory for this session
    fs.mkdirSync(path.join(this.storagePath, id), { recursive: true });

    this.bus.emit('session:created', { sessionId: id });
    log.info('Session created', { id, owner: config.owner });

    return runtime;
  }

  /**
   * Get a session by ID. Returns undefined if not found.
   */
  get(id: string): SessionRuntime | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get a session or throw.
   */
  require(id: string): SessionRuntime {
    const session = this.sessions.get(id);
    if (!session) throw new Error(`Session "${id}" not found`);
    return session;
  }

  /**
   * Update a session's runtime state.
   */
  updateState(id: string, patch: Partial<SessionState>): void {
    const session = this.sessions.get(id);
    if (!session) {
      log.debug('updateState called on unknown session (ignored)', { id });
      return;
    }
    Object.assign(session.state, patch);
    this.bus.emit('session:state_changed', { sessionId: id, state: session.state });
    log.debug('Session state updated', { id, status: session.state.status });
  }

  /**
   * Update a session's configuration. Changes take effect immediately.
   */
  updateConfig(id: string, patch: Partial<SessionConfig>): void {
    const session = this.sessions.get(id);
    if (!session) return;
    Object.assign(session.config, patch);
    this.cache.clearPrefix(session.cacheNamespace);
    log.debug('Session config updated', { id });
  }

  /**
   * Remove a session from the registry (does NOT delete files).
   */
  remove(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id);
    this.cache.clearPrefix(session.cacheNamespace);
    log.info('Session removed', { id });
    return true;
  }

  /**
   * Increment reconnect attempts and return the new count.
   */
  incrementReconnectAttempts(id: string): number {
    const session = this.sessions.get(id);
    if (!session) return 0;
    session.state.reconnectAttempts++;
    return session.state.reconnectAttempts;
  }

  resetReconnectAttempts(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.state.reconnectAttempts = 0;
  }

  hasExceededReconnectLimit(id: string): boolean {
    const session = this.sessions.get(id);
    return (session?.state.reconnectAttempts ?? 0) >= SESSION_MAX_RECONNECT_ATTEMPTS;
  }

  getAll(): SessionRuntime[] {
    return [...this.sessions.values()];
  }

  getIds(): string[] {
    return [...this.sessions.keys()];
  }

  count(): number {
    return this.sessions.size;
  }

  getSessionStoragePath(id: string): string {
    return path.join(this.storagePath, id);
  }
}
