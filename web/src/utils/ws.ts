/**
 * PAPPYBOT V2 — WebSocket Client
 */

import { store } from '../stores/store';
import { toast } from './toast';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;

export function connectWs(token: string): void {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${proto}://${location.host}/ws?token=${encodeURIComponent(token)}`;

  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 1000;
    store.pushLog({ ts: Date.now(), level: 'success', message: 'WebSocket connected' });
    // Heartbeat
    setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' })), 30_000);
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data as string) as { type: string; payload: unknown; ts: number };
      handleWsMessage(msg.type, msg.payload);
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    store.pushLog({ ts: Date.now(), level: 'warn', message: 'WebSocket disconnected — reconnecting...' });
    scheduleReconnect(token);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect(token: string): void {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 1.5, 30_000);
    connectWs(token);
  }, reconnectDelay);
}

function handleWsMessage(type: string, payload: unknown): void {
  const p = payload as Record<string, unknown>;

  switch (type) {
    case 'session:connected':
      store.pushLog({ ts: Date.now(), level: 'success', message: `Session connected: ${p['sessionId']}` });
      toast.success(`Session connected: ${p['sessionId']}`);
      break;

    case 'session:disconnected':
      store.pushLog({ ts: Date.now(), level: 'warn', message: `Session disconnected: ${p['sessionId']}` });
      toast.warning(`Session disconnected: ${p['sessionId']}`);
      break;

    case 'session:state_changed':
      store.pushLog({ ts: Date.now(), level: 'info', message: `Session state: ${p['sessionId']} → ${(p['state'] as Record<string,unknown>)?.['status']}` });
      break;

    case 'runtime:snapshot':
      store.set('snapshot', payload as never);
      break;

    case 'log:line':
      store.pushLog({ ts: Date.now(), level: 'info', message: String(p['line'] ?? '') });
      break;

    case 'intro:submitted':
      toast.info(`New intro submission for group ${p['groupJid']}`);
      break;

    case 'notification':
      toast.info(String(p['message'] ?? ''));
      break;

    case 'anti:triggered':
      store.pushLog({ ts: Date.now(), level: 'warn', message: `Anti: ${p['detectorId']} → ${p['action']} in ${p['groupJid']}` });
      break;

    case 'group:updated':
      store.pushLog({ ts: Date.now(), level: 'info', message: `Group updated: ${p['groupJid']}` });
      break;
  }
}
