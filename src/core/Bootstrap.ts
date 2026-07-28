/**
 * PAPPYBOT V2 — Bootstrap Entry Point
 *
 * Startup sequence:
 *   1. Load .env
 *   2. Initialize the App (all subsystems)
 *   3. Create a default session (if GLOBAL_OWNER_NUMBER is set)
 *   4. Start the session → scan QR or resume from saved auth
 *   5. Register graceful shutdown handlers
 *
 * All subsystems (Telegram panel, web dashboard, AI assistant,
 * group management, anti system, gstatus) are initialized from App.ts.
 * Add new subsystems there — never modify this bootstrap entry point.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { App } from './App';
import { logger } from '../logger/Logger';

const log = logger.child('Bootstrap');

async function main(): Promise<void> {
  log.info('Starting PAPPYBOT V2...');

  // Ensure required storage directories exist
  for (const dir of ['storage/sessions', 'storage/media', 'logs']) {
    fs.mkdirSync(path.resolve(dir), { recursive: true });
  }

  const app = new App();
  await app.initialize();

  // Register shutdown handlers before starting sessions
  registerShutdownHandlers(app);

  // ── No auto-session on startup ───────────────────────────────────────
  // Sessions are created and paired via the Telegram panel or Web API.
  // Set GLOBAL_OWNER_NUMBER in .env only to set the owner JID for permissions —
  // it does NOT auto-start a WhatsApp session.
  const ownerNumber = process.env['GLOBAL_OWNER_NUMBER'];
  if (ownerNumber) {
    log.info('Owner configured. Use Telegram panel or Web API to pair a session.', { owner: ownerNumber });
  } else {
    log.warn('GLOBAL_OWNER_NUMBER not set — set it in .env for owner permissions.');
  }
}

function registerShutdownHandlers(app: App): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info('Shutdown signal received', { signal });
    try {
      await app.shutdown();
    } catch (err) {
      log.error('Error during shutdown', { error: String(err) });
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', async (err) => {
    log.fatal('Uncaught exception', { error: err.message, stack: err.stack });
    await shutdown('uncaughtException');
  });
  process.on('unhandledRejection', async (reason) => {
    log.fatal('Unhandled rejection', { reason: String(reason) });
    await shutdown('unhandledRejection');
  });
}

main().catch((err) => {
  logger.fatal('Bootstrap failed', { error: String(err) });
  process.exit(1);
});
