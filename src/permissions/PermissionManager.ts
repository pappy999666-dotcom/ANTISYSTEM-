/**
 * PAPPYBOT V2 — Permission Manager (RBAC)
 *
 * Manages role assignments and permission checks across sessions.
 * Roles inherit upwards: GLOBAL_OWNER > SESSION_OWNER > SUDO > ADMIN > USER
 */

import { ROLES, ROLE_HIERARCHY, type Role, type PermissionContext } from '../types/Permissions';
import { logger } from '../logger/Logger';
import type { CacheManager } from '../cache/CacheManager';

const log = logger.child('PermissionManager');

export class PermissionManager {
  /** Map of sessionId → Map of jid → Role */
  private readonly assignments = new Map<string, Map<string, Role>>();
  /** Global assignments (apply across all sessions) */
  private readonly globalAssignments = new Map<string, Role>();

  private readonly cache: CacheManager;
  private readonly globalOwner?: string;

  constructor(cache: CacheManager, globalOwner?: string) {
    this.cache = cache;
    this.globalOwner = globalOwner;
    if (globalOwner) {
      this.globalAssignments.set(globalOwner, ROLES.GLOBAL_OWNER);
      log.info('Global owner set', { jid: globalOwner });
    }
  }

  /**
   * Assign a role to a JID within a session (or globally if sessionId = '*').
   */
  assign(jid: string, role: Role, sessionId = '*'): void {
    if (sessionId === '*') {
      this.globalAssignments.set(jid, role);
    } else {
      if (!this.assignments.has(sessionId)) {
        this.assignments.set(sessionId, new Map());
      }
      this.assignments.get(sessionId)!.set(jid, role);
    }
    this.invalidateCache(jid, sessionId);
    log.debug('Role assigned', { jid, role, sessionId });
  }

  /**
   * Revoke a role assignment.
   */
  revoke(jid: string, sessionId = '*'): boolean {
    let removed = false;
    if (sessionId === '*') {
      removed = this.globalAssignments.delete(jid);
    } else {
      removed = this.assignments.get(sessionId)?.delete(jid) ?? false;
    }
    if (removed) this.invalidateCache(jid, sessionId);
    return removed;
  }

  /**
   * Get the effective role for a JID in a session.
   * Global assignments take precedence over session-level assignments.
   */
  getRole(jid: string, sessionId: string): Role {
    const cacheKey = `perm:${jid}:${sessionId}`;
    const cached = this.cache.get<Role>(cacheKey);
    if (cached) return cached;

    // Check global owner
    if (this.globalOwner && jid === this.globalOwner) {
      this.cache.set(cacheKey, ROLES.GLOBAL_OWNER, 60);
      return ROLES.GLOBAL_OWNER;
    }

    // Check global assignments
    const globalRole = this.globalAssignments.get(jid);
    if (globalRole) {
      this.cache.set(cacheKey, globalRole, 60);
      return globalRole;
    }

    // Check session-level assignments
    const sessionRole = this.assignments.get(sessionId)?.get(jid);
    if (sessionRole) {
      this.cache.set(cacheKey, sessionRole, 60);
      return sessionRole;
    }

    this.cache.set(cacheKey, ROLES.USER, 60);
    return ROLES.USER;
  }

  /**
   * Check if a JID has at least the given role in the hierarchy.
   */
  async hasRole(jid: string, requiredRole: Role, sessionId: string): Promise<boolean> {
    const actualRole = this.getRole(jid, sessionId);
    const actualIndex = ROLE_HIERARCHY.indexOf(actualRole);
    const requiredIndex = ROLE_HIERARCHY.indexOf(requiredRole);
    return actualIndex >= requiredIndex;
  }

  /**
   * Check permissions from a PermissionContext object.
   */
  async check(ctx: PermissionContext, requiredRole: Role): Promise<boolean> {
    return this.hasRole(ctx.senderJid, requiredRole, ctx.sessionId);
  }

  /** Return all role assignments for a session */
  listAssignments(sessionId: string): Array<{ jid: string; role: Role }> {
    const result: Array<{ jid: string; role: Role }> = [];
    for (const [jid, role] of this.globalAssignments) {
      result.push({ jid, role });
    }
    const sessionMap = this.assignments.get(sessionId);
    if (sessionMap) {
      for (const [jid, role] of sessionMap) {
        result.push({ jid, role });
      }
    }
    return result;
  }

  private invalidateCache(jid: string, sessionId: string): void {
    this.cache.delete(`perm:${jid}:${sessionId}`);
    this.cache.delete(`perm:${jid}:*`);
  }
}
