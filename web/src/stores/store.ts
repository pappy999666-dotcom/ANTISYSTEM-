/**
 * PAPPYBOT V2 — Global State Store
 * Lightweight reactive store using EventTarget.
 */

import type { SessionInfo, GroupInfo, RuntimeSnapshot } from '../utils/api';

export interface AppState {
  user: { id: string; displayName: string; domain?: string; allocatedPort: number; isOwner: boolean } | null;
  sessions: SessionInfo[];
  groups: GroupInfo[];
  snapshot: RuntimeSnapshot | null;
  logs: LogLine[];
  activePage: string;
  activeSessionId: string | null;
  activeGroupJid: string | null;
  bridgeSessionId: string | null;
  bridgeGroupJid: string | null;
  sidebarOpen: boolean;
  loading: Record<string, boolean>;
}

export interface LogLine {
  ts: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

class Store extends EventTarget {
  private state: AppState = {
    user: null,
    sessions: [],
    groups: [],
    snapshot: null,
    logs: [],
    activePage: 'dashboard',
    activeSessionId: null,
    activeGroupJid: null,
    bridgeSessionId: null,
    bridgeGroupJid: null,
    sidebarOpen: false,
    loading: {},
  };

  get<K extends keyof AppState>(key: K): AppState[K] {
    return this.state[key];
  }

  set<K extends keyof AppState>(key: K, value: AppState[K]): void {
    this.state[key] = value;
    this.dispatchEvent(new CustomEvent('change', { detail: { key, value } }));
    this.dispatchEvent(new CustomEvent(`change:${key}`, { detail: value }));
  }

  patch<K extends keyof AppState>(key: K, patch: Partial<AppState[K]>): void {
    this.state[key] = { ...this.state[key] as object, ...patch as object } as AppState[K];
    this.dispatchEvent(new CustomEvent('change', { detail: { key } }));
    this.dispatchEvent(new CustomEvent(`change:${key}`, { detail: this.state[key] }));
  }

  on<K extends keyof AppState>(key: K, cb: (value: AppState[K]) => void): () => void {
    const handler = (e: Event) => cb((e as CustomEvent).detail as AppState[K]);
    this.addEventListener(`change:${key}`, handler);
    return () => this.removeEventListener(`change:${key}`, handler);
  }

  setLoading(key: string, v: boolean): void {
    this.state.loading[key] = v;
    this.dispatchEvent(new CustomEvent('change:loading', { detail: this.state.loading }));
  }

  isLoading(key: string): boolean {
    return this.state.loading[key] ?? false;
  }

  pushLog(line: LogLine): void {
    const logs = [...this.state.logs, line].slice(-200);
    this.set('logs', logs);
  }

  navigate(page: string): void {
    this.set('activePage', page);
    window.history.pushState({}, '', `#${page}`);
  }
}

export const store = new Store();

// Restore page from hash on load
const hash = window.location.hash.slice(1);
if (hash) store.set('activePage', hash);
window.addEventListener('popstate', () => {
  const h = window.location.hash.slice(1);
  if (h) store.set('activePage', h);
});
