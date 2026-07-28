/**
 * PAPPYBOT V2 — Runtime API Routes
 */

import { Router } from 'express';
import { requireAuth, requireOwner } from '../middleware/auth';
import type { RuntimeMonitor } from '../../services/RuntimeMonitor';
import { telegramStore } from '../../telegram/core/TelegramStore';

export function createRuntimeRouter(monitor: RuntimeMonitor): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/runtime/snapshot
  router.get('/snapshot', (_req, res) => {
    const snap = monitor.snapshot();
    res.json({
      capturedAt: snap.capturedAt,
      sessions: snap.sessions,
      memory: {
        rss: snap.memory.rss,
        heapUsed: snap.memory.heapUsed,
        heapTotal: snap.memory.heapTotal,
        external: snap.memory.external,
      },
      throughput: snap.throughput,
      totalReconnects: snap.totalReconnects,
      activeSockets: snap.activeSockets,
      uptimeMs: monitor.getUptimeMs(),
    });
  });

  // GET /api/runtime/users (owner only)
  router.get('/users', requireOwner, (_req, res) => {
    const users = telegramStore.getAllUsers().map(u => ({
      telegramId: u.telegramId,
      displayName: u.displayName,
      domain: u.domain,
      allocatedPort: u.allocatedPort,
      isBanned: u.isBanned,
      registeredAt: u.registeredAt,
      lastActiveAt: u.lastActiveAt,
    }));
    res.json(users);
  });

  // POST /api/runtime/users/:id/ban (owner only)
  router.post('/users/:id/ban', requireOwner, (req, res) => {
    telegramStore.banUser(Number(req.params['id']));
    res.json({ ok: true });
  });

  // POST /api/runtime/users/:id/unban (owner only)
  router.post('/users/:id/unban', requireOwner, (req, res) => {
    telegramStore.unbanUser(Number(req.params['id']));
    res.json({ ok: true });
  });

  // GET /api/runtime/maintenance (owner only)
  router.get('/maintenance', requireOwner, (_req, res) => {
    res.json({ enabled: telegramStore.isMaintenanceMode() });
  });

  // POST /api/runtime/maintenance (owner only)
  router.post('/maintenance', requireOwner, (req, res) => {
    const { enabled } = req.body as { enabled: boolean };
    telegramStore.setMaintenanceMode(enabled);
    res.json({ ok: true, enabled });
  });

  return router;
}
