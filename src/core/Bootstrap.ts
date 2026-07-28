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
 * Future prompts add Telegram control panel, web dashboard,
 * AI assistant, and group management by importing from this
 * established foundation — never modifying core directly.
 */

import 'dotenv/config';
import { App } from './App';
import { logger } from '../logger/Logger';

const log = logger.child('Bootstrap');

async function main(): Promise<void> {
  log.info('Starting PAPPYBOT V2...');

  const app = new App();
  await app.initialize();

  // Register shutdown handlers before starting sessions
  registerShutdownHandlers(app);

  // ── Create default session ─────────────────────────────────────────────
  const ownerNumber = process.env['GLOBAL_OWNER_NUMBER'];
  if (!ownerNumber) {
    log.warn(
      'GLOBAL_OWNER_NUMBER not set. Set it in .env to auto-start a session.\n' +
      'You can start sessions manually via the API or Telegram panel (future prompts).'
    );
    return;
  }

  const { container } = await import('./Container');
  const { SessionManager: SM } = await import('../managers/SessionManager');
  const sessionManager = container.resolve<InstanceType<typeof SM>>('SessionManager');

  const session = sessionManager.create({
    owner: `${ownerNumber}@s.whatsapp.net`,
    label: 'default',
    settings: {},
  });

  log.info('Starting default session...', { sessionId: session.config.id });
  await app.startSession(session.config.id);
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
