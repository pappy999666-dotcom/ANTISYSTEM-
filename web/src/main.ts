/**
 * PAPPYBOT V2 — Main App Entry
 */

import './styles/global.css';
import { store } from './stores/store';
import { auth as api } from './utils/api';
import { connectWs } from './utils/ws';
import { renderSidebar } from './components/Sidebar';
import { renderLogin } from './pages/Login';
import { renderDashboard } from './pages/Dashboard';
import { renderSessions } from './pages/Sessions';
import { renderGroups, renderGroupDetail } from './pages/Groups';
import { renderBridge } from './pages/Bridge';
import { renderLogs } from './pages/Logs';
import { renderIntro } from './pages/Intro';
import { renderOwner } from './pages/Owner';

const appEl = document.getElementById('app')!;

async function boot(): Promise<void> {
  // Try to restore session
  try {
    const me = await api.me();
    store.set('user', { id: me.id, displayName: me.displayName, domain: me.domain, allocatedPort: me.allocatedPort, isOwner: me.isOwner });
    renderApp();
  } catch {
    renderLoginPage();
  }
}

function renderLoginPage(): void {
  appEl.innerHTML = '';
  renderLogin(appEl, () => {
    renderApp();
  });
}

function renderApp(): void {
  // Connect WebSocket — token is in cookie, pass a placeholder; server reads cookie
  // For WS auth we need the token — re-login to get it in memory
  connectWs('cookie'); // server will reject if invalid; handled gracefully

  appEl.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar" id="sidebar"></aside>
      <div class="main-content">
        <header class="topbar">
          <button class="btn btn-ghost btn-icon btn-sm" id="sidebar-toggle" style="display:none">☰</button>
          <span id="topbar-title" style="font-weight:600;font-size:0.95rem"></span>
          <div style="margin-left:auto;display:flex;gap:0.5rem">
            <button class="btn btn-ghost btn-sm" id="topbar-logout">Sign Out</button>
          </div>
        </header>
        <main class="page-content" id="page-content"></main>
      </div>
    </div>
  `;

  // Mobile sidebar toggle
  const sidebarToggle = document.getElementById('sidebar-toggle')!;
  if (window.innerWidth < 768) sidebarToggle.style.display = 'flex';
  sidebarToggle.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar')!;
    sidebar.classList.toggle('open');
  });

  document.getElementById('topbar-logout')?.addEventListener('click', async () => {
    await api.logout().catch(() => void 0);
    store.set('user', null);
    renderLoginPage();
  });

  const sidebar = document.getElementById('sidebar')!;
  const pageContent = document.getElementById('page-content')!;
  const topbarTitle = document.getElementById('topbar-title')!;

  const PAGE_TITLES: Record<string, string> = {
    dashboard: '⚡ Dashboard', sessions: '📱 Sessions', groups: '👥 Groups',
    'group-detail': '👥 Group', bridge: '🌉 Bridge', logs: '📋 Live Logs',
    intro: '🪪 Intro System', uploads: '📤 Uploads', reports: '📬 Reports',
    settings: '⚙️ Settings', owner: '👑 Owner Panel', notifications: '🔔 Notifications',
    templates: '📝 Templates', support: '💬 Support',
  };

  async function renderPage(page: string): Promise<void> {
    topbarTitle.textContent = PAGE_TITLES[page] ?? page;
    pageContent.innerHTML = '';

    // Re-render sidebar to update active state
    renderSidebar(sidebar);

    switch (page) {
      case 'dashboard':    await renderDashboard(pageContent); break;
      case 'sessions':     await renderSessions(pageContent); break;
      case 'groups':       await renderGroups(pageContent); break;
      case 'group-detail': await renderGroupDetail(pageContent); break;
      case 'bridge':       await renderBridge(pageContent); break;
      case 'logs':         renderLogs(pageContent); break;
      case 'intro':        await renderIntro(pageContent); break;
      case 'owner':        await renderOwner(pageContent); break;
      default:
        pageContent.innerHTML = `<div class="card" style="text-align:center;padding:3rem">
          <div style="font-size:3rem;margin-bottom:1rem">${PAGE_TITLES[page]?.split(' ')[0] ?? '🚧'}</div>
          <h3>${PAGE_TITLES[page] ?? page}</h3>
          <p class="text-secondary mt-2">This section is coming soon.</p>
        </div>`;
    }
  }

  // Initial render
  renderSidebar(sidebar);
  renderPage(store.get('activePage'));

  // Page change listener
  store.on('activePage', (page) => renderPage(page));
  store.on('user', () => renderSidebar(sidebar));
}

boot();
