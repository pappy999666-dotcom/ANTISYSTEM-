/**
 * PAPPYBOT V2 — Owner Panel Page
 */

import { store } from '../stores/store';
import { runtime as api } from '../utils/api';
import { toast } from '../utils/toast';

export async function renderOwner(container: HTMLElement): Promise<void> {
  if (!store.get('user')?.isOwner) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:3rem"><h3>⛔ Owner Only</h3></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page-enter">
      <h1 class="mb-4">👑 Owner Panel</h1>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="card">
          <h3 class="mb-4">System Stats</h3>
          <div id="owner-stats"><div class="skeleton" style="height:120px"></div></div>
        </div>
        <div class="card">
          <h3 class="mb-4">Maintenance</h3>
          <div id="owner-maintenance"><div class="skeleton" style="height:60px"></div></div>
        </div>
      </div>
      <div class="card mt-4">
        <div class="flex items-center justify-between mb-4">
          <h3>Users</h3>
          <button class="btn btn-ghost btn-sm" id="owner-load-users">Load Users</button>
        </div>
        <div id="owner-users"><p class="text-muted text-sm">Click Load Users to view all registered users.</p></div>
      </div>
    </div>
  `;

  // Load stats
  try {
    const snap = await api.snapshot();
    const statsEl = container.querySelector('#owner-stats')!;
    statsEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:0.5rem">
        <div class="flex justify-between"><span class="text-muted">Sessions</span><strong>${snap.sessions.length}</strong></div>
        <div class="flex justify-between"><span class="text-muted">Connected</span><strong class="text-green">${snap.sessions.filter(s => s.status === 'connected').length}</strong></div>
        <div class="flex justify-between"><span class="text-muted">Memory RSS</span><strong>${(snap.memory.rss / 1024 / 1024).toFixed(1)} MB</strong></div>
        <div class="flex justify-between"><span class="text-muted">Heap Used</span><strong>${(snap.memory.heapUsed / 1024 / 1024).toFixed(1)} MB</strong></div>
        <div class="flex justify-between"><span class="text-muted">Messages ↓</span><strong>${snap.throughput.messagesReceived}</strong></div>
        <div class="flex justify-between"><span class="text-muted">Commands</span><strong>${snap.throughput.commandsExecuted}</strong></div>
        <div class="flex justify-between"><span class="text-muted">Errors</span><strong class="text-red">${snap.throughput.commandErrors}</strong></div>
      </div>
    `;
  } catch (err) { toast.error(String(err)); }

  // Maintenance
  try {
    const { enabled } = await api.maintenance();
    const maintEl = container.querySelector('#owner-maintenance')!;
    maintEl.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="text-sm font-weight:600">Maintenance Mode</div>
          <div class="text-xs text-muted">Blocks all non-owner commands</div>
        </div>
        <button class="btn ${enabled ? 'btn-danger' : 'btn-ghost'}" id="maint-toggle">
          ${enabled ? '🔧 ON — Disable' : '✅ OFF — Enable'}
        </button>
      </div>
    `;
    container.querySelector('#maint-toggle')?.addEventListener('click', async () => {
      try {
        await api.setMaintenance(!enabled);
        toast.success(`Maintenance mode ${!enabled ? 'enabled' : 'disabled'}`);
        renderOwner(container);
      } catch (err) { toast.error(String(err)); }
    });
  } catch (err) { toast.error(String(err)); }

  // Load users
  container.querySelector('#owner-load-users')?.addEventListener('click', async () => {
    try {
      const users = await api.users();
      const el = container.querySelector('#owner-users')!;
      el.innerHTML = users.map(u => `
        <div class="flex items-center gap-3" style="padding:0.6rem 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div class="text-sm">${u.displayName} <code class="text-xs">${u.telegramId}</code></div>
            <div class="text-xs text-muted">Port: ${u.allocatedPort} · ${u.domain ?? 'no domain'} · Last: ${new Date(u.lastActiveAt).toLocaleDateString()}</div>
          </div>
          <span class="badge ${u.isBanned ? 'badge-red' : 'badge-green'}">${u.isBanned ? '🚫 Banned' : '✅ Active'}</span>
          ${u.isBanned
            ? `<button class="btn btn-success btn-sm" data-unban="${u.telegramId}">Unban</button>`
            : `<button class="btn btn-danger btn-sm" data-ban="${u.telegramId}">Ban</button>`}
        </div>
      `).join('') || '<p class="text-muted text-sm">No users registered.</p>';

      el.querySelectorAll('[data-ban]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number((btn as HTMLElement).dataset['ban']);
          if (!confirm(`Ban user ${id}?`)) return;
          try { await api.banUser(id); toast.success('User banned'); renderOwner(container); } catch (err) { toast.error(String(err)); }
        });
      });
      el.querySelectorAll('[data-unban]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = Number((btn as HTMLElement).dataset['unban']);
          try { await api.unbanUser(id); toast.success('User unbanned'); renderOwner(container); } catch (err) { toast.error(String(err)); }
        });
      });
    } catch (err) { toast.error(String(err)); }
  });
}
