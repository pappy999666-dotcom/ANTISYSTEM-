/**
 * PAPPYBOT V2 — Web Server
 *
 * Express HTTP server + WebSocket server.
 * Serves REST API and the compiled frontend.
 * Auto-starts if WEB_PORT is set.
 */

import http from 'http';
import path from 'path';
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
const WEB_PORT = Number(process.env['WEB_PORT'] ?? 3000);

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

    // Health check
    app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

    // Serve compiled frontend (production)
    try {
      const fs = require('fs') as typeof import('fs');
      if (fs.existsSync(WEB_DIST)) {
        app.use(express.static(WEB_DIST));
        // SPA fallback — serve index.html for all non-API routes
        app.get('*', (req, res) => {
          if (!req.path.startsWith('/api') && !req.path.startsWith('/ws')) {
            res.sendFile(path.join(WEB_DIST, 'index.html'));
          }
        });
      }
    } catch { /* dist not built yet */ }

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
