/**
 * PAPPYBOT V2 — Base Plugin
 *
 * All plugins must extend this class. A plugin can register:
 *   - Commands
 *   - Listeners
 *   - Middlewares
 *   - Services
 *   - Scheduled jobs
 */

import type { PluginMeta } from '../types/Plugin';
import type { CommandEngine } from '../engines/CommandEngine';
import type { ListenerManager } from '../listeners/ListenerManager';
import type { MiddlewareEngine } from '../middlewares/MiddlewareEngine';
import type { SchedulerService } from '../schedulers/SchedulerService';
import type { EventBus } from '../events/EventBus';
import { logger } from '../logger/Logger';

export interface PluginContext {
  commands: CommandEngine;
  listeners: ListenerManager;
  middlewares: MiddlewareEngine;
  scheduler: SchedulerService;
  bus: EventBus;
}

export abstract class BasePlugin {
  protected readonly log = logger.child(this.constructor.name);

  abstract readonly meta: PluginMeta;

  /**
   * Called when the plugin is loaded.
   * Register all commands, listeners, middlewares, and jobs here.
   */
  abstract load(ctx: PluginContext): Promise<void>;

  /**
   * Called when the plugin is unloaded.
   * Clean up any resources, intervals, or listeners created in load().
   */
  async unload(_ctx: PluginContext): Promise<void> {
    // Default: no-op. Override if cleanup is needed.
  }
}
