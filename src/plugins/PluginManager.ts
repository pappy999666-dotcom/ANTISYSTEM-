/**
 * PAPPYBOT V2 — Plugin Manager
 *
 * Loads, unloads, and manages the lifecycle of all plugins.
 * Plugins are isolated — one plugin failure never crashes others.
 */

import type { BasePlugin, PluginContext } from './BasePlugin';
import type { PluginState } from '../types/Plugin';
import type { EventBus } from '../events/EventBus';
import { logger } from '../logger/Logger';

const log = logger.child('PluginManager');

export class PluginManager {
  private readonly plugins = new Map<string, BasePlugin>();
  private readonly states = new Map<string, PluginState>();
  private readonly bus: EventBus;
  private readonly ctx: PluginContext;

  constructor(bus: EventBus, ctx: PluginContext) {
    this.bus = bus;
    this.ctx = ctx;
  }

  /**
   * Load a plugin. Safe to call on already-loaded plugins (no-op).
   */
  async load(plugin: BasePlugin): Promise<void> {
    const { id, name, dependencies = [] } = plugin.meta;

    if (this.states.get(id)?.status === 'loaded') {
      log.warn('Plugin already loaded', { id });
      return;
    }

    // Check dependencies
    for (const dep of dependencies) {
      if (this.states.get(dep)?.status !== 'loaded') {
        const msg = `Plugin "${id}" depends on "${dep}" which is not loaded`;
        log.error(msg);
        this.setState(id, plugin, 'error', msg);
        return;
      }
    }

    this.setState(id, plugin, 'loading');

    try {
      await plugin.load(this.ctx);
      this.plugins.set(id, plugin);
      this.setState(id, plugin, 'loaded');
      await this.bus.emit('plugin:loaded', { pluginId: id });
      log.info('Plugin loaded', { id, name });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.setState(id, plugin, 'error', error.message);
      await this.bus.emit('plugin:error', { pluginId: id, error });
      log.error('Plugin failed to load', { id, error: error.message });
    }
  }

  /**
   * Unload a plugin gracefully.
   */
  async unload(id: string): Promise<boolean> {
    const plugin = this.plugins.get(id);
    if (!plugin) {
      log.warn('Plugin not found for unload', { id });
      return false;
    }

    try {
      await plugin.unload(this.ctx);
      this.plugins.delete(id);
      this.setState(id, plugin, 'unloaded');
      await this.bus.emit('plugin:unloaded', { pluginId: id });
      log.info('Plugin unloaded', { id });
      return true;
    } catch (err) {
      log.error('Plugin unload failed', { id, error: String(err) });
      return false;
    }
  }

  /**
   * Reload a plugin (unload then load).
   */
  async reload(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) throw new Error(`Plugin "${id}" not found`);
    await this.unload(id);
    await this.load(plugin);
  }

  /**
   * Load multiple plugins, respecting declared dependencies.
   */
  async loadAll(plugins: BasePlugin[]): Promise<void> {
    // Topological order: load dependencies first
    const ordered = this.topoSort(plugins);
    for (const plugin of ordered) {
      await this.load(plugin);
    }
    log.info(`Loaded ${this.plugins.size}/${plugins.length} plugin(s)`);
  }

  getState(id: string): PluginState | undefined {
    return this.states.get(id);
  }

  isLoaded(id: string): boolean {
    return this.states.get(id)?.status === 'loaded';
  }

  listLoaded(): string[] {
    return [...this.states.entries()]
      .filter(([, s]) => s.status === 'loaded')
      .map(([id]) => id);
  }

  private setState(id: string, plugin: BasePlugin, status: PluginState['status'], error?: string): void {
    this.states.set(id, {
      meta: plugin.meta,
      status,
      loadedAt: status === 'loaded' ? new Date() : undefined,
      error,
    });
  }

  private topoSort(plugins: BasePlugin[]): BasePlugin[] {
    const map = new Map(plugins.map((p) => [p.meta.id, p]));
    const visited = new Set<string>();
    const result: BasePlugin[] = [];

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);
      const plugin = map.get(id);
      if (!plugin) return;
      for (const dep of plugin.meta.dependencies ?? []) {
        visit(dep);
      }
      result.push(plugin);
    };

    for (const p of plugins) {
      visit(p.meta.id);
    }
    return result;
  }
}
