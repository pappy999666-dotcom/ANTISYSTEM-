/**
 * Plugin system types — defines the lifecycle and registration
 * contract for all PAPPYBOT plugins/modules.
 */

export interface PluginMeta {
  /** Unique plugin identifier (lowercase, no spaces) */
  id: string;
  /** Human-readable name */
  name: string;
  version: string;
  description: string;
  author?: string;
  /** Plugin IDs this plugin depends on */
  dependencies?: string[];
}

export type PluginStatus = 'unloaded' | 'loading' | 'loaded' | 'error' | 'disabled';

export interface PluginState {
  meta: PluginMeta;
  status: PluginStatus;
  loadedAt?: Date;
  error?: string;
}
