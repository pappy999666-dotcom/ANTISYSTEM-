/**
 * PAPPYBOT V2 — Backup API
 * GET    /api/backup          — list backups
 * POST   /api/backup          — create backup
 * POST   /api/backup/:id/restore — restore backup
 * DELETE /api/backup/:id      — delete backup
 */

import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth';
import { backupService } from '../../services/BackupService';

export function createBackupRouter(): Router {
  const router = Router();

  router.get('/', requireAuth, requireOwner, (_req, res) => {
    res.json({ backups: backupService.list() });
  });

  router.post('/', requireAuth, requireOwner, async (_req, res) => {
    try {
      const id = await backupService.create();
      res.json({ ok: true, id });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post('/:id/restore', requireAuth, requireOwner, (req, res) => {
    try {
      backupService.restore(String(req.params['id']));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  router.delete('/:id', requireAuth, requireOwner, (req, res) => {
    try {
      backupService.delete(String(req.params['id']));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  return router;
}
