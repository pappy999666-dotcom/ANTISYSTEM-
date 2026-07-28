/**
 * PAPPYBOT V2 — Sessions API Routes
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import type { AuthToken } from '../types/Web';
import type { SessionManager } from '../../managers/SessionManager';
import type { App } from '../../core/App';
import type { Request } from 'express';

type AuthReq = Request & { user: AuthToken };

export function createSessionsRouter(app: App, sessionManager: SessionManager): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/sessions
  router.get('/', (req, res) => {
    const sessions = sessionManager.getAll().map(s => ({
      id: s.config.id,
      label: s.config.label,
      owner: s.config.owner,
      status: s.state.status,
      phoneNumber: s.state.phoneNumber,
      displayName: s.state.displayName,
      connectedAt: s.state.connectedAt,
      reconnectAttempts: s.state.reconnectAttempts,
      commandPrefix: s.config.commandPrefix,
    }));
    res.json(sessions);
  });

  // GET /api/sessions/:id
  router.get('/:id', (req, res) => {
    const s = sessionManager.get(req.params['id']!);
    if (!s) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json({
      id: s.config.id,
      label: s.config.label,
      owner: s.config.owner,
      status: s.state.status,
      phoneNumber: s.state.phoneNumber,
      displayName: s.state.displayName,
      connectedAt: s.state.connectedAt,
      reconnectAttempts: s.state.reconnectAttempts,
      commandPrefix: s.config.commandPrefix,
      settings: s.config.settings,
    });
  });

  // POST /api/sessions/:id/reconnect
  router.post('/:id/reconnect', async (req, res) => {
    const id = req.params['id']!;
    try {
      await app.startSession(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/sessions/:id/logout
  router.post('/:id/logout', async (req, res) => {
    const id = req.params['id']!;
    try {
      await app.stopSession(id);
      sessionManager.remove(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/sessions/:id
  router.delete('/:id', async (req, res) => {
    const id = req.params['id']!;
    try {
      await app.stopSession(id);
      sessionManager.remove(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // PATCH /api/sessions/:id
  router.patch('/:id', (req, res) => {
    const id = req.params['id']!;
    const { label, commandPrefix } = req.body as { label?: string; commandPrefix?: string };
    try {
      sessionManager.updateConfig(id, { label, commandPrefix });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/sessions (create + pair)
  router.post('/', async (req, res) => {
    const { id, label, method } = req.body as { id?: string; label?: string; method?: 'code' | 'qr' };
    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    try {
      if (!sessionManager.get(id)) {
        sessionManager.create({ id, owner: '', label: label ?? id, settings: {} });
      }
      await app.startSession(id);
      res.json({ ok: true, sessionId: id });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
