/**
 * PAPPYBOT V2 — Auth Routes
 * POST /api/auth/login   — login with telegramId + secret
 * POST /api/auth/logout  — clear cookie
 * GET  /api/auth/me      — current user
 */

import { Router } from 'express';
import { telegramStore } from '../../telegram/core/TelegramStore';
import { signToken, requireAuth } from '../middleware/auth';
import type { AuthToken } from '../types/Web';

const router = Router();

const WEB_SECRET = process.env['WEB_SECRET'] ?? 'pappybot-web-login-secret';

// POST /api/auth/login
// Body: { telegramId: number, secret: string }
router.post('/login', (req, res) => {
  const { telegramId, secret } = req.body as { telegramId?: number; secret?: string };

  if (!telegramId || !secret) {
    res.status(400).json({ error: 'telegramId and secret required' });
    return;
  }

  if (secret !== WEB_SECRET) {
    res.status(401).json({ error: 'Invalid secret' });
    return;
  }

  const user = telegramStore.getUser(telegramId);
  if (!user) {
    res.status(404).json({ error: 'User not registered. Please register via Telegram first.' });
    return;
  }

  if (user.isBanned) {
    res.status(403).json({ error: 'Account banned' });
    return;
  }

  const token = signToken(String(telegramId));
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
  });

  res.json({ ok: true, user: { id: telegramId, displayName: user.displayName, domain: user.domain } });
});

// POST /api/auth/logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const auth = (req as typeof req & { user: AuthToken }).user;
  const user = telegramStore.getUser(Number(auth.userId));
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({
    id: auth.userId,
    displayName: user.displayName,
    domain: user.domain,
    allocatedPort: user.allocatedPort,
    isOwner: auth.isOwner,
    commandPrefix: user.commandPrefix,
    notificationsEnabled: user.notificationsEnabled,
  });
});

export default router;
