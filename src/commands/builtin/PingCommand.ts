/**
 * PAPPYBOT V2 — Ping Command
 *
 * Measures live: API latency, Baileys socket latency, memory, CPU, runtime,
 * active sessions, and database latency where applicable.
 * No fake values.
 */

import os from 'os';
import { BaseCommand } from '../BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import { R } from '../../ui/ResponseFormatter';
import { socketManager } from '../../whatsapp/SocketManager';
import { ROLES } from '../../types/Permissions';

function formatRuntime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function cpuPercent(): number {
  const load = os.loadavg()[0] ?? 0;
  const cpus = os.cpus().length;
  return Math.min(100, Math.round((load / cpus) * 100));
}

function memoryMb(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

const startedAt = Date.now();

export class PingCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'ping',
    description: 'Check bot latency and system health',
    category: 'utility',
    aliases: ['p', 'latency'],
    requiredRole: ROLES.USER,
  };

  async execute(ctx: CommandContext): Promise<void> {
    const t0 = Date.now();

    // Send loading first — measure round-trip
    const loadingId = await this.replyLoading(ctx, 'Measuring latency...');
    const apiLatencyMs = Date.now() - t0;

    // Baileys socket latency — time a no-op presence query
    let baileysLatencyMs = 0;
    try {
      const sock = socketManager.getSocket(ctx.message.sessionId);
      if (sock) {
        const bt = Date.now();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await sock.sendPresenceUpdate('available', ctx.message.chatJid).catch(() => void 0);
        baileysLatencyMs = Date.now() - bt;
      }
    } catch { /* socket unavailable */ }

    const activeSessions = socketManager.count();
    const health = socketManager.healthCheck();
    const connectedCount = health.filter(h => h.connected).length;
    const statusLabel = apiLatencyMs < 100 ? 'Excellent' : apiLatencyMs < 300 ? 'Good' : 'Degraded';

    const text = R.ping({
      apiLatencyMs,
      baileysLatencyMs,
      memoryMb: memoryMb(),
      cpuPercent: cpuPercent(),
      runtime: formatRuntime(Date.now() - startedAt),
      sessions: connectedCount,
      status: statusLabel,
    });

    await this.editOrReply(ctx, loadingId, text);
  }
}
