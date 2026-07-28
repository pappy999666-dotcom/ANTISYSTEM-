/**
 * PAPPYBOT V2 — Dashboard Page
 */

import { store } from '../stores/store';
import { runtime, sessions as sessionsApi, groups as groupsApi } from '../utils/api';
import { toast } from '../utils/toast';

function fmtBytes(b: number): string {
  return (b / 1024 / 1024).toFixed(1) + ' MB';
}
function fmtUptime(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export async function renderDashboard(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1>Dashboard</h1>
          <p class="text-secondary text-sm">Welcome back, ${store.get('user')?.displayName ?? 'User'}</p>
        </div>
        <button class="btn btn-ghost btn-sm" id="dash-refresh">🔄 Refresh</button>
      </div>
      <div class="stat-grid" id="stat-grid">
        ${[1,2,3,4,5,6].map(() => `<div class="stat-card"><div class="skeleton" style="height:60px"></div></div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.5rem" id="dash-lower">
        <div class="card">
          <h3 class="mb-4">Recent Sessions</h3>
          <div id="dash-sessions-list"><div class="skeleton" style="height:120px"></div></div>
        </div>
        <div class="card">
          <h3 class="mb-4">Quick Actions</h3>
          <div style="display:flex;flex-direction:column;gap:0.5rem">
            <button class="btn btn-ghost w-full" data-nav="sessions">📱 Manage Sessions</button>
            <button class="btn btn-ghost w-full" data-nav="groups">👥 Browse Groups</button>
            <button class="btn btn-ghost w-full" data-nav="bridge">🌉 Open Bridge</button>
            <button class="btn btn-ghost w-full" data-nav="intro">🪪 Intro System</button>
            <button class="btn btn-ghost w-full" data-nav="logs">📋 Live Logs</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => store.navigate((btn as HTMLElement).dataset['nav']!));
  });

  container.querySelector('#dash-refresh')?.addEventListener('click', () => loadData());

  async function loadData(): Promise<void> {
    try {
      const [snap, sess, grps] = await Promise.all([
        runtime.snapshot(),
        sessionsApi.list(),
        groupsApi.list(),
      ]);
      store.set('snapshot', snap);
      store.set('sessions', sess);
      store.set('groups', grps);

      const connected = snap.sessions.filter(s => s.status === 'connected').length;
      const disconnected = snap.sessions.filter(s => s.status === 'disconnected').length;

      const grid = container.querySelector('#stat-grid')!;
      grid.innerHTML = `
        <div class="stat-card">
          <div class="stat-label">Connected</div>
          <div class="stat-value text-green">${connected}</div>
          <div class="stat-sub">Active sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Disconnected</div>
          <div class="stat-value text-red">${disconnected}</div>
          <div class="stat-sub">Offline sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Groups</div>
          <div class="stat-value text-accent">${grps.length}</div>
          <div class="stat-sub">Managed groups</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Memory</div>
          <div class="stat-value">${fmtBytes(snap.memory.rss)}</div>
          <div class="stat-sub">RSS usage</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Messages</div>
          <div class="stat-value">${snap.throughput.messagesReceived}</div>
          <div class="stat-sub">↓ Received</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Uptime</div>
          <div class="stat-value">${fmtUptime(snap.uptimeMs)}</div>
          <div class="stat-sub">Since start</div>
        </div>
      `;

      const sessionsList = container.querySelector('#dash-sessions-list')!;
      sessionsList.innerHTML = sess.slice(0, 4).map(s => {
        const dot = s.status === 'connected' ? 'dot-green' : s.status === 'connecting' ? 'dot-yellow' : 'dot-red';
        return `
          <div class="flex items-center gap-3" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
            <span class="dot ${dot}"></span>
            <div style="flex:1">
              <div class="text-sm font-weight:600">${s.label ?? s.id}</div>
              <div class="text-xs text-muted">${s.phoneNumber ?? 'Not connected'}</div>
            </div>
            <button class="btn btn-ghost btn-sm" data-session="${s.id}">Open</button>
          </div>
        `;
      }).join('') || '<p class="text-muted text-sm">No sessions yet.</p>';

      sessionsList.querySelectorAll('[data-session]').forEach(btn => {
        btn.addEventListener('click', () => {
          store.set('activeSessionId', (btn as HTMLElement).dataset['session']!);
          store.navigate('sessions');
        });
      });
    } catch (err) {
      toast.error(`Failed to load dashboard: ${String(err)}`);
    }
  }

  await loadData();

  // Live updates from store
  store.on('snapshot', (snap) => {
    if (!snap) return;
    // Silently update stats without full re-render
  });
}
