/**
 * PAPPYBOT V2 — Groups API Routes
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { SocketManager } from '../../whatsapp/SocketManager';

export function createGroupsRouter(groupCache: GroupCache, socketManager: SocketManager): Router {
  const router = Router();
  router.use(requireAuth);

  // GET /api/groups?sessionId=xxx
  router.get('/', (req, res) => {
    const groups = groupCache.getAll().map(g => ({
      jid: g.id,
      name: g.subject,
      description: g.description,
      memberCount: g.participants.length,
      adminCount: g.participants.filter(p => p.isAdmin).length,
      announce: g.announce,
      restrict: g.restrict,
      inviteCode: g.inviteCode,
    }));
    res.json(groups);
  });

  // GET /api/groups/:jid
  router.get('/:jid', (req, res) => {
    const jid = decodeURIComponent(req.params['jid']!);
    const g = groupCache.get(jid);
    if (!g) { res.status(404).json({ error: 'Group not found' }); return; }
    res.json({
      jid: g.id,
      name: g.subject,
      description: g.description,
      participants: g.participants,
      announce: g.announce,
      restrict: g.restrict,
      inviteCode: g.inviteCode,
      ephemeralDuration: g.ephemeralDuration,
      cachedAt: g.cachedAt,
    });
  });

  // GET /api/groups/:jid/participants
  router.get('/:jid/participants', (req, res) => {
    const jid = decodeURIComponent(req.params['jid']!);
    const g = groupCache.get(jid);
    if (!g) { res.status(404).json({ error: 'Group not found' }); return; }
    res.json(g.participants);
  });

  // POST /api/groups/:jid/refresh — force metadata refresh
  router.post('/:jid/refresh', async (req, res) => {
    const jid = decodeURIComponent(req.params['jid']!);
    const { sessionId } = req.body as { sessionId?: string };
    if (!sessionId) { res.status(400).json({ error: 'sessionId required' }); return; }

    const sock = socketManager.getSocket(sessionId);
    if (!sock) { res.status(503).json({ error: 'Session not connected' }); return; }

    try {
      const raw = await sock.groupMetadata(jid) as Record<string, unknown>;
      const participants = ((raw['participants'] as Array<Record<string, unknown>>) ?? []).map(p => ({
        jid: p['id'] as string,
        isAdmin: (p['admin'] as string | undefined) === 'admin' || (p['admin'] as string | undefined) === 'superadmin',
        isSuperAdmin: (p['admin'] as string | undefined) === 'superadmin',
      }));
      groupCache.set({
        id: jid,
        subject: raw['subject'] as string ?? '',
        description: raw['desc'] as string | undefined,
        owner: raw['owner'] as string | undefined,
        participants,
        announce: (raw['announce'] as boolean | undefined) ?? false,
        restrict: (raw['restrict'] as boolean | undefined) ?? false,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
