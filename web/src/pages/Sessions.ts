/**
 * PAPPYBOT V2 — Sessions Page
 */

import { store } from '../stores/store';
import { sessions as api } from '../utils/api';
import { toast } from '../utils/toast';
import { showModal } from '../components/Modal';

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    connected: 'badge-green', disconnected: 'badge-red',
    connecting: 'badge-yellow', reconnecting: 'badge-yellow',
    qr_pending: 'badge-blue', initializing: 'badge-blue',
    logged_out: 'badge-red', error: 'badge-red',
  };
  const dot: Record<string, string> = {
    connected: 'dot-green', disconnected: 'dot-red',
    connecting: 'dot-yellow', reconnecting: 'dot-yellow',
  };
  return `<span class="badge ${map[status] ?? 'badge-blue'}"><span class="dot ${dot[status] ?? 'dot-gray'}"></span>${status.replace(/_/g, ' ')}</span>`;
}

function fmtUptime(ms: number): string {
  if (!ms) return '—';
  const m = Math.floor(ms / 60_000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export async function renderSessions(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center justify-between mb-4">
        <h1>Sessions</h1>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" id="sess-refresh">🔄 Refresh</button>
          <button class="btn btn-primary btn-sm" id="sess-new">➕ New Session</button>
        </div>
      </div>
      <div class="session-grid" id="session-grid">
        ${[1,2,3].map(() => `<div class="card"><div class="skeleton" style="height:140px"></div></div>`).join('')}
      </div>
    </div>
  `;

  container.querySelector('#sess-refresh')?.addEventListener('click', load);
  container.querySelector('#sess-new')?.addEventListener('click', () => showNewSessionModal());

  async function load(): Promise<void> {
    try {
      const list = await api.list();
      store.set('sessions', list);
      renderList(list);
    } catch (err) {
      toast.error(String(err));
    }
  }

  function renderList(list: typeof store extends { get: (k: 'sessions') => infer T } ? T : never): void {
    const grid = container.querySelector('#session-grid')!;
    if (!list.length) {
      grid.innerHTML = `<div class="card" style="grid-column:1/-1;text-align:center;padding:3rem">
        <div style="font-size:3rem;margin-bottom:1rem">📱</div>
        <h3>No sessions yet</h3>
        <p class="text-secondary mt-2">Pair your first WhatsApp account to get started.</p>
        <button class="btn btn-primary mt-4" id="sess-new-empty">➕ Pair Session</button>
      </div>`;
      grid.querySelector('#sess-new-empty')?.addEventListener('click', showNewSessionModal);
      return;
    }

    grid.innerHTML = list.map(s => `
      <div class="session-card" data-id="${s.id}">
        <div class="session-card-header">
          <div class="session-card-icon">📱</div>
          <div style="flex:1;min-width:0">
            <div class="session-card-title truncate">${s.label ?? s.id}</div>
            <div class="session-card-phone">${s.phoneNumber ?? 'Not connected'}</div>
          </div>
          ${statusBadge(s.status)}
        </div>
        <div class="session-card-meta">
          <span>Reconnects: ${s.reconnectAttempts}</span>
          <span>Prefix: <code>${s.commandPrefix ?? '!'}</code></span>
        </div>
        <div class="session-card-actions">
          <button class="btn btn-ghost btn-sm" data-action="groups" data-id="${s.id}">👥 Groups</button>
          <button class="btn btn-ghost btn-sm" data-action="reconnect" data-id="${s.id}">🔄</button>
          <button class="btn btn-ghost btn-sm" data-action="rename" data-id="${s.id}">✏️</button>
          <button class="btn btn-danger btn-sm" data-action="logout" data-id="${s.id}">🚪</button>
          <button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}">🗑</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = (btn as HTMLElement).dataset['action']!;
        const id = (btn as HTMLElement).dataset['id']!;
        await handleAction(action, id);
      });
    });
  }

  async function handleAction(action: string, id: string): Promise<void> {
    try {
      if (action === 'reconnect') {
        await api.reconnect(id);
        toast.success('Reconnect initiated');
        await load();
      } else if (action === 'logout') {
        if (!confirm(`Logout session "${id}"?`)) return;
        await api.logout(id);
        toast.success('Session logged out');
        await load();
      } else if (action === 'delete') {
        if (!confirm(`Delete session "${id}"? This cannot be undone.`)) return;
        await api.delete(id);
        toast.success('Session deleted');
        await load();
      } else if (action === 'rename') {
        const label = prompt('New session name:');
        if (!label) return;
        await api.rename(id, label);
        toast.success('Session renamed');
        await load();
      } else if (action === 'groups') {
        store.set('activeSessionId', id);
        store.navigate('groups');
      }
    } catch (err) {
      toast.error(String(err));
    }
  }

  function showNewSessionModal(): void {
    showModal({
      title: '➕ Pair New Session',
      body: `
        <div class="form-group">
          <label class="form-label">Session ID</label>
          <input class="form-input" id="new-sess-id" placeholder="e.g. main, business" />
        </div>
        <div class="form-group">
          <label class="form-label">Label (optional)</label>
          <input class="form-input" id="new-sess-label" placeholder="Display name" />
        </div>
      `,
      confirmLabel: '🔗 Pair',
      onConfirm: async () => {
        const id = (document.getElementById('new-sess-id') as HTMLInputElement).value.trim();
        const label = (document.getElementById('new-sess-label') as HTMLInputElement).value.trim();
        if (!id) { toast.error('Session ID required'); return; }
        try {
          await api.create(id, label || undefined);
          toast.success(`Session "${id}" created — scan QR or enter pairing code`);
          await load();
        } catch (err) {
          toast.error(String(err));
        }
      },
    });
  }

  await load();
}
