/**
 * PAPPYBOT V2 — Sessions API Routes
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import type { SessionManager } from '../../managers/SessionManager';
import type { App } from '../../core/App';
import type { PairingEngine } from '../../pairing/PairingEngine';
import { sessionMetrics } from '../../pairing/SessionMetrics';
import { container } from '../../core/Container';

export function createSessionsRouter(app: App, sessionManager: SessionManager): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/sessions
  router.get('/', (_req, res) => {
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

  // GET /api/sessions/metrics
  router.get('/metrics', (_req, res) => {
    res.json(sessionMetrics.snapshot());
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

  // GET /api/sessions/:id/health
  router.get('/:id/health', (req, res) => {
    const snap = app.sessionHealth?.getSnapshot(req.params['id']!);
    if (!snap) { res.status(404).json({ error: 'Session not found' }); return; }
    res.json(snap);
  });

  // POST /api/sessions/:id/reconnect
  router.post('/:id/reconnect', async (req, res) => {
    const id = req.params['id']!;
    try {
      const cm = container.tryResolve<import('../../pairing/ConnectionManager').ConnectionManager>('ConnectionManager');
      if (cm) {
        await cm.reconnect(id);
      } else {
        await app.startSession(id);
      }
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // POST /api/sessions/:id/logout
  router.post('/:id/logout', async (req, res) => {
    const id = req.params['id']!;
    try {
      await app.logoutSession(id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // DELETE /api/sessions/:id
  router.delete('/:id', async (req, res) => {
    const id = req.params['id']!;
    try {
      await app.deleteSession(id);
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

  // POST /api/sessions — create + pair
  router.post('/', async (req, res) => {
    const { id, label, method, phoneNumber, customCode } = req.body as {
      id?: string;
      label?: string;
      method?: 'code' | 'qr';
      phoneNumber?: string;
      customCode?: string;
    };

    if (!id) { res.status(400).json({ error: 'id required' }); return; }
    if (method === 'code' && !phoneNumber) { res.status(400).json({ error: 'phoneNumber required for code method' }); return; }

    try {
      const pairingEngine = container.tryResolve<PairingEngine>('PairingEngine');
      if (pairingEngine && method) {
        const result = await pairingEngine.pair({
          sessionId: id,
          method: method ?? 'qr',
          phoneNumber,
          customCode,
          label: label ?? id,
        });
        res.json({ ok: true, sessionId: id, pairingCode: result.pairingCode, status: result.status });
      } else {
        // Fallback: create + start without pairing engine
        if (!sessionManager.get(id)) {
          sessionManager.create({ id, owner: '', label: label ?? id, settings: {} });
        }
        await app.startSession(id);
        res.json({ ok: true, sessionId: id });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
