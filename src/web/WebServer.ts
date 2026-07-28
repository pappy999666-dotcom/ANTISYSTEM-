/**
 * PAPPYBOT V2 — Web Server
 *
 * Express HTTP server + WebSocket server.
 * Serves REST API and the compiled frontend.
 * Auto-starts if WEB_PORT is set.
 */

import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { WsServer } from './ws/WsServer';
import { IntroService } from './intro/IntroService';
import { ReportService } from './intro/ReportService';
import authRouter from './api/auth';
import { createSessionsRouter } from './api/sessions';
import { createGroupsRouter } from './api/groups';
import { createRuntimeRouter } from './api/runtime';
import { createIntroRouter } from './api/intro';
import { createUploadRouter, createReportRouter } from './api/upload';
import { createBridgeRouter } from './api/bridge';
import { createBackupRouter } from './api/backup';
import type { App } from '../core/App';
import type { SessionManager } from '../managers/SessionManager';
import type { RuntimeMonitor } from '../services/RuntimeMonitor';
import type { EventBus } from '../events/EventBus';
import type { GroupCache } from '../whatsapp/GroupCache';
import type { SocketManager } from '../whatsapp/SocketManager';
import type { CommandEngine } from '../engines/CommandEngine';
import { logger } from '../logger/Logger';

const log = logger.child('WebServer');
const WEB_DIST = path.resolve('web/dist');
const WEB_PORT = Number(process.env['WEB_PORT'] ?? 5000);

export class WebServer {
  private readonly httpServer: http.Server;
  private readonly wsServer: WsServer;
  readonly introService: IntroService;
  readonly reportService: ReportService;

  constructor(
    private readonly app: App,
    private readonly sessionManager: SessionManager,
    private readonly monitor: RuntimeMonitor,
    private readonly bus: EventBus,
    private readonly groupCache: GroupCache,
    private readonly socketManager: SocketManager,
    private readonly commandEngine: CommandEngine
  ) {
    const expressApp = express();
    this.httpServer = http.createServer(expressApp);
    this.wsServer = new WsServer(this.httpServer, bus, monitor);
    this.introService = new IntroService(socketManager, groupCache);
    this.reportService = new ReportService(socketManager);

    this.configureExpress(expressApp);
  }

  private configureExpress(app: express.Application): void {
    // Security
    app.set('trust proxy', 1); // trust nginx reverse proxy
    app.use(helmet({
      contentSecurityPolicy: false, // allow inline scripts in dev
      crossOriginEmbedderPolicy: false,
    }));
    app.use(cors({
      origin: process.env['WEB_ORIGIN'] ?? true,
      credentials: true,
    }));
    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    app.use('/api/', rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false }));
    app.use('/api/auth/', rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false }));

    // API routes
    app.use('/api/auth', authRouter);
    app.use('/api/sessions', createSessionsRouter(this.app, this.sessionManager));
    app.use('/api/groups', createGroupsRouter(this.groupCache, this.socketManager));
    app.use('/api/runtime', createRuntimeRouter(this.monitor));
    app.use('/api/intro', createIntroRouter(this.introService, this.wsServer));
    app.use('/api/upload', createUploadRouter(this.reportService, this.wsServer));
    app.use('/api/report', createReportRouter(this.reportService, this.wsServer));
    app.use('/api/bridge', createBridgeRouter(this.socketManager, this.commandEngine, this.sessionManager));
    app.use('/api/backup', createBackupRouter());

    // Health check
    app.get('/health', (_req, res) => {
      const snap = this.monitor.snapshot();
      const connectedSessions = snap.sessions.filter(s => s.status === 'connected').length;
      const memMB = (snap.memory.rss / 1024 / 1024).toFixed(1);
      res.json({
        ok: true,
        uptime: process.uptime(),
        version: process.env['npm_package_version'] ?? '2.0.0',
        sessions: { total: snap.sessions.length, connected: connectedSessions },
        memory: { rss: `${memMB} MB`, heapUsed: `${(snap.memory.heapUsed / 1024 / 1024).toFixed(1)} MB` },
        throughput: snap.throughput,
        activeSockets: snap.activeSockets,
        capturedAt: snap.capturedAt,
      });
    });

    // Serve compiled frontend (production)
    if (fs.existsSync(WEB_DIST)) {
      app.use(express.static(WEB_DIST));
      // SPA fallback — Express 5 compatible wildcard
      app.get('/{*path}', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
          res.sendFile(path.join(WEB_DIST, 'index.html'));
        }
      });
    }

    // Global error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      log.error('Express error', { error: err.message });
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer.listen(WEB_PORT, () => {
        log.info(`Web server started on port ${WEB_PORT}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.wsServer.stop();
    return new Promise((resolve) => {
      this.httpServer.close(() => {
        log.info('Web server stopped');
        resolve();
      });
    });
  }

  getWsServer(): WsServer {
    return this.wsServer;
  }
}
