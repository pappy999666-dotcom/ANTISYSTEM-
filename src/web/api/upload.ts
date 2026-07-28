/**
 * PAPPYBOT V2 — Upload & Report API Routes
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireOwner } from '../middleware/auth';
import { storageService } from '../storage/StorageService';
import type { ReportService } from '../intro/ReportService';
import type { WsServer } from '../ws/WsServer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function createUploadRouter(reportService: ReportService, wsServer: WsServer): Router {
  const router = Router();

  // POST /api/upload — anonymous file upload
  router.post('/', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

    if (!storageService.validateSize(file.size, 50)) {
      res.status(413).json({ error: 'File too large (max 50MB)' });
      return;
    }

    const record = storageService.store(file.originalname, file.buffer, file.mimetype, 'anonymous');
    wsServer.broadcast('upload:complete', { id: record.id, name: record.originalName });
    res.json({ id: record.id, name: record.originalName, size: record.sizeBytes, mime: record.mimeType });
  });

  // GET /api/upload/:id — serve file
  router.get('/:id', (req, res) => {
    const filePath = storageService.getPath(req.params['id']!);
    if (!filePath) { res.status(404).json({ error: 'File not found' }); return; }
    const record = storageService.get(req.params['id']!);
    res.setHeader('Content-Type', record?.mimeType ?? 'application/octet-stream');
    res.sendFile(filePath);
  });

  // DELETE /api/upload/:id (auth required)
  router.delete('/:id', requireAuth, (req, res) => {
    const ok = storageService.delete(String(req.params['id']));
    res.json({ ok });
  });

  return router;
}

export function createReportRouter(reportService: ReportService, wsServer: WsServer): Router {
  const router = Router();

  // POST /api/report — submit anonymous report
  router.post('/', upload.array('files', 5), async (req, res) => {
    const { message, whatsappNumber, name } = req.body as {
      message?: string;
      whatsappNumber?: string;
      name?: string;
    };

    if (!message) { res.status(400).json({ error: 'message required' }); return; }

    const files = req.files as Express.Multer.File[] | undefined;
    const fileIds: string[] = [];

    for (const file of files ?? []) {
      if (!storageService.validateSize(file.size, 20)) continue;
      const record = storageService.store(file.originalname, file.buffer, file.mimetype, 'report');
      fileIds.push(record.id);
    }

    try {
      const sub = await reportService.submit(message, fileIds, whatsappNumber, name);
      res.json({ ok: true, id: sub.id });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/report (owner only)
  router.get('/', requireAuth, requireOwner, (_req, res) => {
    res.json(reportService.getAll());
  });

  // POST /api/report/destination (owner only)
  router.post('/destination', requireAuth, requireOwner, (req, res) => {
    const { sessionId, groupJid } = req.body as { sessionId: string; groupJid: string };
    if (!sessionId || !groupJid) { res.status(400).json({ error: 'sessionId and groupJid required' }); return; }
    reportService.setDestination(sessionId, groupJid);
    res.json({ ok: true });
  });

  return router;
}
