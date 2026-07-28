/**
 * PAPPYBOT V2 — Web Auth Middleware
 *
 * JWT-based auth. Tokens are issued on login via Telegram identity.
 * No duplicate auth logic — reads from TelegramStore.
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthToken } from '../types/Web';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'pappybot-web-secret-change-in-production';
const JWT_EXPIRY = '7d';
const GLOBAL_OWNER_TG_ID = Number(process.env['TELEGRAM_OWNER_ID'] ?? '0');

export function signToken(userId: string): string {
  const isOwner = Number(userId) === GLOBAL_OWNER_TG_ID;
  return jwt.sign({ userId, isOwner }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifyToken(token: string): AuthToken | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthToken;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.['token'] ?? req.headers['authorization']?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const decoded = verifyToken(token);
  if (!decoded) { res.status(401).json({ error: 'Invalid token' }); return; }

  (req as Request & { user: AuthToken }).user = decoded;
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const user = (req as Request & { user?: AuthToken }).user;
  if (!user?.isOwner) { res.status(403).json({ error: 'Owner only' }); return; }
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.['token'] ?? req.headers['authorization']?.replace('Bearer ', '');
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) (req as Request & { user: AuthToken }).user = decoded;
  }
  next();
}
