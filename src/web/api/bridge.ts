/**
 * PAPPYBOT V2 — Bridge API Routes
 *
 * Allows the web dashboard to send messages/commands to WhatsApp groups.
 * Never duplicates command logic — calls SocketManager directly for raw sends,
 * or routes through CommandEngine for commands.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { CommandEngine } from '../../engines/CommandEngine';
import type { SessionManager } from '../../managers/SessionManager';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function createBridgeRouter(
  socketManager: SocketManager,
  commandEngine: CommandEngine,
  sessionManager: SessionManager
): Router {
  const router = Router();
  router.use(requireAuth);

  // POST /api/bridge/send
  // Body: { sessionId, groupJid, text?, mediaBuffer?, mediaType?, mimeType?, fileName? }
  router.post('/send', upload.single('media'), async (req, res) => {
    const { sessionId, groupJid, text, mediaType, mimeType, fileName } =
      req.body as {
        sessionId: string;
        groupJid: string;
        text?: string;
        mediaType?: string;
        mimeType?: string;
        fileName?: string;
      };

    if (!sessionId || !groupJid) {
      res.status(400).json({ error: 'sessionId and groupJid required' });
      return;
    }

    const sock = socketManager.getSocket(sessionId);
    if (!sock) { res.status(503).json({ error: 'Session not connected' }); return; }

    try {
      const file = req.file;

      if (file) {
        const type = mediaType ?? file.mimetype.split('/')[0];
        switch (type) {
          case 'image':
            await sock.sendMessage(groupJid, { image: file.buffer, caption: text ?? '' });
            break;
          case 'video':
            await sock.sendMessage(groupJid, { video: file.buffer, caption: text ?? '' });
            break;
          case 'audio':
            await sock.sendMessage(groupJid, { audio: file.buffer, mimetype: mimeType ?? file.mimetype });
            break;
          case 'document':
          default:
            await sock.sendMessage(groupJid, {
              document: file.buffer,
              fileName: fileName ?? file.originalname,
              mimetype: mimeType ?? file.mimetype,
            });
        }
      } else if (text) {
        await sock.sendMessage(groupJid, { text });
      } else {
        res.status(400).json({ error: 'text or media required' });
        return;
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // GET /api/bridge/commands — list available commands
  router.get('/commands', (_req, res) => {
    res.json(commandEngine.getRegistered().map(m => ({
      name: m.name,
      description: m.description,
      usage: m.usage,
      category: m.category,
      aliases: m.aliases,
    })));
  });

  return router;
}
