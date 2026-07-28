/**
 * PAPPYBOT V2 — Groups Page
 */

import { store } from '../stores/store';
import { groups as api, sessions as sessApi } from '../utils/api';
import { toast } from '../utils/toast';
import type { GroupInfo } from '../utils/api';

export async function renderGroups(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center justify-between mb-4">
        <h1>Groups</h1>
        <div class="flex gap-2">
          <input class="form-input" id="group-search" placeholder="🔍 Search groups..." style="width:220px" />
          <button class="btn btn-ghost btn-sm" id="groups-refresh">🔄 Refresh</button>
        </div>
      </div>
      <div id="groups-content">
        <div class="skeleton" style="height:300px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  let allGroups: GroupInfo[] = [];

  container.querySelector('#groups-refresh')?.addEventListener('click', load);
  container.querySelector('#group-search')?.addEventListener('input', (e) => {
    const q = (e.target as HTMLInputElement).value.toLowerCase();
    renderList(allGroups.filter(g => g.name.toLowerCase().includes(q) || g.jid.includes(q)));
  });

  async function load(): Promise<void> {
    try {
      allGroups = await api.list();
      store.set('groups', allGroups);
      renderList(allGroups);
    } catch (err) {
      toast.error(String(err));
    }
  }

  function renderList(list: GroupInfo[]): void {
    const content = container.querySelector('#groups-content')!;
    if (!list.length) {
      content.innerHTML = `<div class="card" style="text-align:center;padding:3rem">
        <div style="font-size:3rem;margin-bottom:1rem">👥</div>
        <h3>No groups found</h3>
        <p class="text-secondary mt-2">Connect a WhatsApp session to see your groups.</p>
      </div>`;
      return;
    }

    content.innerHTML = `<div class="group-list">${list.map(g => `
      <div class="group-item" data-jid="${g.jid}">
        <div class="group-avatar">👥</div>
        <div style="flex:1;min-width:0">
          <div class="group-name truncate">${g.name}</div>
          <div class="group-meta">${g.memberCount} members · ${g.adminCount} admins</div>
        </div>
        <div class="group-badges">
          ${g.announce ? '<span class="badge badge-yellow">🔒 Announce</span>' : ''}
          <span class="badge badge-blue">${g.memberCount} 👥</span>
        </div>
      </div>
    `).join('')}</div>`;

    content.querySelectorAll('.group-item[data-jid]').forEach(el => {
      el.addEventListener('click', () => {
        store.set('activeGroupJid', (el as HTMLElement).dataset['jid']!);
        store.navigate('group-detail');
      });
    });
  }

  await load();
}

export async function renderGroupDetail(container: HTMLElement): Promise<void> {
  const jid = store.get('activeGroupJid');
  if (!jid) { store.navigate('groups'); return; }

  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center gap-3 mb-4">
        <button class="btn btn-ghost btn-sm" id="back-groups">← Back</button>
        <h1 id="group-title">Loading...</h1>
        <button class="btn btn-ghost btn-sm" id="group-refresh">🔄</button>
      </div>
      <div id="group-detail-content">
        <div class="skeleton" style="height:400px;border-radius:var(--radius-lg)"></div>
      </div>
    </div>
  `;

  container.querySelector('#back-groups')?.addEventListener('click', () => store.navigate('groups'));
  container.querySelector('#group-refresh')?.addEventListener('click', load);

  async function load(): Promise<void> {
    try {
      const g = await api.get(jid);
      const titleEl = container.querySelector('#group-title')!;
      titleEl.textContent = g.name;

      const content = container.querySelector('#group-detail-content')!;
      const admins = (g.participants ?? []).filter(p => p.isAdmin);
      const members = (g.participants ?? []).filter(p => !p.isAdmin);

      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
          <div class="card">
            <h3 class="mb-4">Group Info</h3>
            <div style="display:flex;flex-direction:column;gap:0.75rem">
              <div class="flex justify-between"><span class="text-muted">JID</span><code class="text-xs">${g.jid.split('@')[0]}</code></div>
              <div class="flex justify-between"><span class="text-muted">Members</span><strong>${g.memberCount}</strong></div>
              <div class="flex justify-between"><span class="text-muted">Admins</span><strong>${g.adminCount}</strong></div>
              <div class="flex justify-between"><span class="text-muted">Announce</span><span class="badge ${g.announce ? 'badge-yellow' : 'badge-blue'}">${g.announce ? 'On' : 'Off'}</span></div>
              <div class="flex justify-between"><span class="text-muted">Restrict</span><span class="badge ${g.restrict ? 'badge-yellow' : 'badge-blue'}">${g.restrict ? 'On' : 'Off'}</span></div>
              ${g.inviteCode ? `<div class="flex justify-between"><span class="text-muted">Invite</span><a href="https://chat.whatsapp.com/${g.inviteCode}" target="_blank" class="text-accent text-xs">Open link</a></div>` : ''}
              ${g.description ? `<div><span class="text-muted text-xs">Description</span><p class="text-sm mt-1">${g.description}</p></div>` : ''}
            </div>
          </div>
          <div class="card">
            <h3 class="mb-4">Quick Actions</h3>
            <div style="display:flex;flex-direction:column;gap:0.5rem">
              <button class="btn btn-primary w-full" data-action="bridge">🌉 Open Bridge</button>
              <button class="btn btn-ghost w-full" data-action="intro">🪪 Intro Settings</button>
              <button class="btn btn-ghost w-full" data-action="participants">👥 View Participants</button>
            </div>
          </div>
        </div>
        <div class="card mt-4">
          <h3 class="mb-4">Admins (${admins.length})</h3>
          <div style="display:flex;flex-wrap:wrap;gap:0.5rem">
            ${admins.map(p => `<span class="badge badge-purple">👑 ${p.jid.split('@')[0]}</span>`).join('') || '<span class="text-muted text-sm">None</span>'}
          </div>
        </div>
      `;

      content.querySelector('[data-action="bridge"]')?.addEventListener('click', () => {
        store.set('bridgeGroupJid', jid);
        store.navigate('bridge');
      });
      content.querySelector('[data-action="intro"]')?.addEventListener('click', () => {
        store.set('activeGroupJid', jid);
        store.navigate('intro');
      });
    } catch (err) {
      toast.error(String(err));
    }
  }

  await load();
}
