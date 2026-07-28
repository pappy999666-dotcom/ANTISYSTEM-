/**
 * PAPPYBOT V2 — Backup Service
 *
 * Supports backup and restore of:
 *   - config/config.json
 *   - SQLite database file
 *   - Session auth directories
 *
 * Backups are written to storage/backups/<timestamp>/.
 * Restore reads from a named backup directory.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../logger/Logger';

const log = logger.child('BackupService');
const BACKUP_ROOT = path.resolve('storage/backups');

export interface BackupManifest {
  id: string;
  createdAt: string;
  files: string[];
}

export class BackupService {
  constructor(
    private readonly sessionsPath = 'storage/sessions',
    private readonly dbPath = 'storage/database.sqlite',
    private readonly configPath = 'config/config.json'
  ) {}

  /**
   * Create a full backup. Returns the backup ID (timestamp string).
   */
  async create(): Promise<string> {
    const id = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_ROOT, id);
    fs.mkdirSync(dest, { recursive: true });

    const files: string[] = [];

    // Backup config
    if (fs.existsSync(this.configPath)) {
      const target = path.join(dest, 'config.json');
      fs.copyFileSync(this.configPath, target);
      files.push('config.json');
    }

    // Backup SQLite DB
    if (fs.existsSync(this.dbPath)) {
      const target = path.join(dest, 'database.sqlite');
      fs.copyFileSync(this.dbPath, target);
      files.push('database.sqlite');
    }

    // Backup session auth dirs
    if (fs.existsSync(this.sessionsPath)) {
      const sessionDirs = fs.readdirSync(this.sessionsPath, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const sessionId of sessionDirs) {
        const src = path.join(this.sessionsPath, sessionId);
        const dst = path.join(dest, 'sessions', sessionId);
        this.copyDir(src, dst);
        files.push(`sessions/${sessionId}`);
      }
    }

    // Write manifest
    const manifest: BackupManifest = { id, createdAt: new Date().toISOString(), files };
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2));

    log.info('Backup created', { id, files: files.length });
    return id;
  }

  /**
   * List all available backups, newest first.
   */
  list(): BackupManifest[] {
    if (!fs.existsSync(BACKUP_ROOT)) return [];
    return fs.readdirSync(BACKUP_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => {
        const manifestPath = path.join(BACKUP_ROOT, d.name, 'manifest.json');
        if (!fs.existsSync(manifestPath)) return null;
        try {
          return JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as BackupManifest;
        } catch { return null; }
      })
      .filter((m): m is BackupManifest => m !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * Restore config and database from a backup ID.
   * Does NOT restore session auth (would require stopping sessions first).
   */
  restore(id: string): void {
    const src = path.join(BACKUP_ROOT, id);
    if (!fs.existsSync(src)) throw new Error(`Backup "${id}" not found`);

    const configSrc = path.join(src, 'config.json');
    if (fs.existsSync(configSrc)) {
      fs.copyFileSync(configSrc, this.configPath);
      log.info('Config restored', { id });
    }

    const dbSrc = path.join(src, 'database.sqlite');
    if (fs.existsSync(dbSrc)) {
      fs.copyFileSync(dbSrc, this.dbPath);
      log.info('Database restored', { id });
    }
  }

  /**
   * Delete a backup by ID.
   */
  delete(id: string): void {
    const target = path.join(BACKUP_ROOT, id);
    if (!fs.existsSync(target)) throw new Error(`Backup "${id}" not found`);
    fs.rmSync(target, { recursive: true, force: true });
    log.info('Backup deleted', { id });
  }

  /**
   * Prune backups older than `maxAgeDays`. Returns count removed.
   */
  prune(maxAgeDays = 7): number {
    const cutoff = Date.now() - maxAgeDays * 86_400_000;
    const all = this.list();
    let removed = 0;
    for (const m of all) {
      if (new Date(m.createdAt).getTime() < cutoff) {
        this.delete(m.id);
        removed++;
      }
    }
    return removed;
  }

  private copyDir(src: string, dst: string): void {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        this.copyDir(s, d);
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }
}

export const backupService = new BackupService();
