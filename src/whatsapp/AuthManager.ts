/**
 * PAPPYBOT V2 — Authentication Manager
 *
 * Wraps @crysnovax/baileys authentication utilities.
 * Provides:
 *  - Multi-file auth state (useMultiFileAuthState) — persistent across restarts
 *  - Pairing code request flow
 *  - Auth clearing for clean logout / re-auth
 *
 * Extension points:
 *  - Future prompt: add custom auth store adapters (DB-backed state)
 */

import path from 'path';
import fs from 'fs';
import { logger } from '../logger/Logger';

const log = logger.child('AuthManager');

export interface AuthState {
  state: unknown;
  saveCreds: () => Promise<void>;
}

export class AuthManager {
  private readonly sessionsPath: string;
  /** In-memory registry of saveCreds functions per session. */
  private readonly credsSavers = new Map<string, () => Promise<void>>();

  constructor(sessionsPath: string) {
    this.sessionsPath = path.resolve(sessionsPath);
  }

  /**
   * Load or create multi-file auth state for a session.
   * Uses the library's useMultiFileAuthState — files are stored under
   * sessionsPath/<sessionId>/.
   */
  async loadAuthState(sessionId: string): Promise<AuthState> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const baileys = require('@crysnovax/baileys') as Record<string, unknown>;
    const useMultiFileAuthState = baileys['useMultiFileAuthState'] as Function;

    if (!useMultiFileAuthState) {
      throw new Error('useMultiFileAuthState not found in @crysnovax/baileys');
    }

    const authPath = path.join(this.sessionsPath, sessionId);
    fs.mkdirSync(authPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authPath) as {
      state: unknown;
      saveCreds: () => Promise<void>;
    };

    // Wrap saveCreds so we can track it and emit events externally
    const wrappedSave = async (): Promise<void> => {
      try {
        await saveCreds();
        log.trace('Credentials saved', { sessionId });
      } catch (err) {
        log.error('Failed to save credentials', { sessionId, error: String(err) });
        throw err;
      }
    };

    this.credsSavers.set(sessionId, wrappedSave);
    log.debug('Auth state loaded', { sessionId, authPath });

    return { state, saveCreds: wrappedSave };
  }

  /**
   * Request a pairing code for phone-number based login.
   * The phone number should be in E.164 format without the '+' prefix.
   * e.g. "15551234567"
   *
   * Requires the socket to be created first with the auth state loaded.
   */
  async requestPairingCode(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket: any,
    phoneNumber: string
  ): Promise<string> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const code = await socket.requestPairingCode(phoneNumber) as string;
      log.info('Pairing code requested', { phoneNumber });
      return code;
    } catch (err) {
      log.error('Failed to request pairing code', { phoneNumber, error: String(err) });
      throw err;
    }
  }

  /**
   * Clear stored auth files for a session (for clean re-pairing / logout).
   * This removes all credential files from disk.
   */
  clearAuthFiles(sessionId: string): void {
    const authPath = path.join(this.sessionsPath, sessionId);
    if (fs.existsSync(authPath)) {
      fs.rmSync(authPath, { recursive: true, force: true });
      log.info('Auth files cleared', { sessionId, authPath });
    }
    this.credsSavers.delete(sessionId);
  }

  /**
   * Check whether stored auth files exist for a session
   * (i.e. can attempt session restoration on next start).
   */
  hasStoredAuth(sessionId: string): boolean {
    const authPath = path.join(this.sessionsPath, sessionId);
    if (!fs.existsSync(authPath)) return false;
    const files = fs.readdirSync(authPath);
    return files.length > 0;
  }

  /**
   * Manually trigger credential save for a session (e.g. after config changes).
   */
  async saveCreds(sessionId: string): Promise<void> {
    const saver = this.credsSavers.get(sessionId);
    if (saver) {
      await saver();
    }
  }

  /** Forget the saver reference for a session without deleting files. */
  forgetSession(sessionId: string): void {
    this.credsSavers.delete(sessionId);
  }

  /** Auth file path for a session. */
  getAuthPath(sessionId: string): string {
    return path.join(this.sessionsPath, sessionId);
  }
}
