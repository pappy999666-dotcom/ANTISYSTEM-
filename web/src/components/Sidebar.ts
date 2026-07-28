/**
 * PAPPYBOT V2 — Sidebar Component
 */

import { store } from '../stores/store';

interface NavItem {
  id: string;
  icon: string;
  label: string;
  ownerOnly?: boolean;
  badge?: () => number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',    icon: '⚡', label: 'Dashboard' },
  { id: 'sessions',     icon: '📱', label: 'Sessions' },
  { id: 'groups',       icon: '👥', label: 'Groups' },
  { id: 'bridge',       icon: '🌉', label: 'Bridge' },
  { id: 'templates',    icon: '📝', label: 'Templates' },
  { id: 'intro',        icon: '🪪', label: 'Intro System' },
  { id: 'uploads',      icon: '📤', label: 'Uploads' },
  { id: 'reports',      icon: '📬', label: 'Reports' },
  { id: 'logs',         icon: '📋', label: 'Live Logs' },
  { id: 'notifications',icon: '🔔', label: 'Notifications' },
  { id: 'settings',     icon: '⚙️', label: 'Settings' },
  { id: 'support',      icon: '💬', label: 'Support' },
  { id: 'owner',        icon: '👑', label: 'Owner Panel', ownerOnly: true },
];

export function renderSidebar(container: HTMLElement): void {
  const user = store.get('user');
  const activePage = store.get('activePage');

  const items = NAV_ITEMS.filter(i => !i.ownerOnly || user?.isOwner);
  const initials = user?.displayName?.slice(0, 2).toUpperCase() ?? 'PB';

  container.innerHTML = `
    <div class="sidebar-logo">
      <div class="logo-icon">⚡</div>
      <div>
        <div class="logo-text">PAPPYBOT V2</div>
        <div class="logo-sub">Control Panel</div>
      </div>
    </div>
    <nav class="sidebar-nav">
      <div class="nav-section">Navigation</div>
      ${items.map(item => `
        <div class="nav-item ${activePage === item.id ? 'active' : ''}" data-page="${item.id}">
          <span class="nav-icon">${item.icon}</span>
          <span>${item.label}</span>
        </div>
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      <div class="user-avatar">${initials}</div>
      <div>
        <div class="user-name">${user?.displayName ?? 'User'}</div>
        <div class="user-role">${user?.isOwner ? '👑 Owner' : 'Member'}</div>
      </div>
    </div>
  `;

  container.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const page = (el as HTMLElement).dataset['page']!;
      store.navigate(page);
      // Close sidebar on mobile
      if (window.innerWidth < 768) store.set('sidebarOpen', false);
    });
  });
}
