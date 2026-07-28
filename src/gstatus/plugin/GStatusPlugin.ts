/**
 * PAPPYBOT V2 — Group Status Engine Plugin
 *
 * Registers .gstatus and .togstatus commands.
 * Creates and owns the StatusEngine instance.
 * Wires into the existing plugin system — no core changes required.
 */

import { BasePlugin } from '../../plugins/BasePlugin';
import type { PluginContext } from '../../plugins/BasePlugin';
import type { PluginMeta } from '../../types/Plugin';
import { StatusEngine } from '../core/StatusEngine';
import { GStatusCommand } from '../commands/GStatusCommand';
import { TogStatusCommand } from '../commands/TogStatusCommand';
import { socketManager } from '../../whatsapp/SocketManager';
import { GroupCache } from '../../whatsapp/GroupCache';
import { MediaEngine } from '../../whatsapp/MediaEngine';
import { logger } from '../../logger/Logger';

const log = logger.child('GStatusPlugin');

export class GStatusPlugin extends BasePlugin {
  readonly meta: PluginMeta = {
    id: 'gstatus',
    name: 'Group Status Engine',
    version: '1.0.0',
    description: 'Post content to WhatsApp Status (Stories) with queue, retry, preview reuse, and togstatus forwarding.',
  };

  private statusEngine!: StatusEngine;

  async load(ctx: PluginContext): Promise<void> {
    const groupCache = new GroupCache();
    const mediaEngine = new MediaEngine(socketManager, ctx.bus);

    this.statusEngine = new StatusEngine(socketManager, ctx.bus, mediaEngine);

    ctx.commands.registerAll([
      new GStatusCommand(this.statusEngine, mediaEngine),
      new TogStatusCommand(this.statusEngine, mediaEngine, groupCache, socketManager, ctx.bus),
    ]);

    ctx.bus.on('status:completed', (p) => {
      const pp = p as Record<string, unknown>;
      log.info('Status completed', { sessionId: pp['sessionId'], id: pp['statusId'], durationMs: pp['durationMs'] });
    });
    ctx.bus.on('status:failed', (p) => {
      const pp = p as Record<string, unknown>;
      log.warn('Status failed', { sessionId: pp['sessionId'], id: pp['statusId'], error: pp['error'] });
    });

    log.info('Group Status Engine plugin loaded');
  }

  getStatusEngine(): StatusEngine {
    return this.statusEngine;
  }
}
