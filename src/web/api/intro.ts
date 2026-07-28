/**
 * PAPPYBOT V2 — Intro API Routes
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth, optionalAuth } from '../middleware/auth';
import type { IntroService } from '../intro/IntroService';
import { storageService } from '../storage/StorageService';
import type { IntroQuestion } from '../types/Web';
import type { WsServer } from '../ws/WsServer';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function createIntroRouter(introService: IntroService, wsServer: WsServer): Router {
  const router = Router();

  // ── Admin routes (auth required) ──────────────────────────────────────────

  // GET /api/intro/:groupJid/config
  router.get('/:groupJid/config', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    const config = introService.getConfig(jid);
    if (!config) { res.status(404).json({ error: 'Not configured' }); return; }
    res.json(config);
  });

  // PUT /api/intro/:groupJid/config
  router.put('/:groupJid/config', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    const { sessionId, ...patch } = req.body as { sessionId: string } & Record<string, unknown>;
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }
    const config = introService.setConfig(jid, sessionId, patch);
    res.json(config);
  });

  // POST /api/intro/:groupJid/questions
  router.post('/:groupJid/questions', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    try {
      const q = introService.addQuestion(jid, req.body as Omit<IntroQuestion, 'id'>);
      res.json(q);
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // PATCH /api/intro/:groupJid/questions/:qid
  router.patch('/:groupJid/questions/:qid', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    try {
      introService.updateQuestion(jid, String(req.params['qid']), req.body as Partial<IntroQuestion>);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // DELETE /api/intro/:groupJid/questions/:qid
  router.delete('/:groupJid/questions/:qid', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    try {
      introService.deleteQuestion(jid, String(req.params['qid']));
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // POST /api/intro/:groupJid/questions/reorder
  router.post('/:groupJid/questions/reorder', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    const { orderedIds } = req.body as { orderedIds: string[] };
    try {
      introService.reorderQuestions(jid, orderedIds);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // POST /api/intro/:groupJid/token — generate token for a member
  router.post('/:groupJid/token', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    const { sessionId, memberJid } = req.body as { sessionId: string; memberJid: string };
    if (!sessionId || !memberJid) { res.status(400).json({ error: 'sessionId and memberJid required' }); return; }
    const token = introService.generateToken(jid, sessionId, memberJid);
    res.json({ token: token.token, expiresAt: token.expiresAt });
  });

  // POST /api/intro/:groupJid/destination
  router.post('/:groupJid/destination', requireAuth, async (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    const { sessionId, destinationJid } = req.body as { sessionId: string; destinationJid: string };
    try {
      await introService.setDestination(jid, sessionId, destinationJid);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  // GET /api/intro/:groupJid/submissions
  router.get('/:groupJid/submissions', requireAuth, (req, res) => {
    const jid = decodeURIComponent(String(req.params['groupJid']));
    res.json(introService.getSubmissionsForGroup(jid));
  });

  // POST /api/intro/submissions/:id/forward
  router.post('/submissions/:id/forward', requireAuth, async (req, res) => {
    try {
      await introService.forwardSubmission(String(req.params['id']));
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── Public routes (token-based, no auth) ──────────────────────────────────

  // GET /api/intro/form/:token — get form for a member
  router.get('/form/:token', optionalAuth, (req, res) => {
    const t = introService.getToken(String(req.params['token']));
    if (!t) { res.status(404).json({ error: 'Invalid or expired token' }); return; }
    if (t.used) { res.status(410).json({ error: 'This intro has already been submitted' }); return; }

    const config = introService.getConfig(t.groupJid);
    if (!config?.enabled) { res.status(404).json({ error: 'Intro not available for this group' }); return; }

    res.json({
      groupJid: t.groupJid,
      welcomeMessage: config.welcomeMessage,
      questions: config.questions,
      mediaRequired: config.mediaRequired,
      maxUploadSizeMb: config.maxUploadSizeMb,
      allowedFileTypes: config.allowedFileTypes,
      expiresAt: t.expiresAt,
    });
  });

  // POST /api/intro/upload/:token — upload media for intro
  router.post('/upload/:token', upload.single('file'), (req, res) => {
    const t = introService.getToken(String(req.params['token']));
    if (!t) { res.status(404).json({ error: 'Invalid or expired token' }); return; }

    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

    const config = introService.getConfig(t.groupJid);
    const maxMb = config?.maxUploadSizeMb ?? 10;
    const allowed = config?.allowedFileTypes ?? [];

    if (!storageService.validateSize(file.size, maxMb)) {
      res.status(413).json({ error: `File too large (max ${maxMb}MB)` });
      return;
    }
    if (!storageService.validateType(file.mimetype, allowed)) {
      res.status(415).json({ error: 'File type not allowed' });
      return;
    }

    const record = storageService.store(file.originalname, file.buffer, file.mimetype, 'intro');
    res.json({ id: record.id, name: record.originalName, size: record.sizeBytes, mime: record.mimeType });
  });

  // POST /api/intro/submit/:token — submit intro form
  router.post('/submit/:token', async (req, res) => {
    const { answers, mediaFiles } = req.body as {
      answers: Record<string, string | string[]>;
      mediaFiles?: string[];
    };

    try {
      const submission = await introService.submit(String(req.params['token']), answers, mediaFiles ?? []);
      wsServer.broadcast('intro:submitted', { submissionId: submission.id, groupJid: submission.groupJid });
      res.json({ ok: true, submissionId: submission.id });
    } catch (err) {
      res.status(400).json({ error: String(err) });
    }
  });

  return router;
}
