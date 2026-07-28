/**
 * PAPPYBOT V2 — Live Logs Page
 */

import { store } from '../stores/store';
import type { LogLine } from '../stores/store';

export function renderLogs(container: HTMLElement): void {
  let paused = false;
  let filter = '';

  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center justify-between mb-4">
        <h1>📋 Live Logs</h1>
        <div class="flex gap-2">
          <input class="form-input" id="log-filter" placeholder="🔍 Filter..." style="width:200px" />
          <button class="btn btn-ghost btn-sm" id="log-pause">⏸ Pause</button>
          <button class="btn btn-ghost btn-sm" id="log-clear">🗑 Clear</button>
          <button class="btn btn-ghost btn-sm" id="log-export">📥 Export</button>
        </div>
      </div>
      <div class="flex gap-2 mb-3" id="log-filters">
        <button class="btn btn-ghost btn-sm active" data-level="all">All</button>
        <button class="btn btn-ghost btn-sm" data-level="info">Info</button>
        <button class="btn btn-ghost btn-sm" data-level="warn">Warn</button>
        <button class="btn btn-ghost btn-sm" data-level="error">Error</button>
        <button class="btn btn-ghost btn-sm" data-level="success">Success</button>
      </div>
      <div class="log-viewer" id="log-viewer"></div>
    </div>
  `;

  let levelFilter = 'all';
  const viewer = container.querySelector('#log-viewer') as HTMLElement;

  function renderLines(lines: LogLine[]): void {
    const filtered = lines.filter(l => {
      if (levelFilter !== 'all' && l.level !== levelFilter) return false;
      if (filter && !l.message.toLowerCase().includes(filter)) return false;
      return true;
    });

    viewer.innerHTML = filtered.map(l => `
      <div class="log-line">
        <span class="log-ts">${new Date(l.ts).toLocaleTimeString()}</span>
        <span class="log-level-${l.level}">[${l.level.toUpperCase()}]</span>
        <span class="log-msg">${escHtml(l.message)}</span>
      </div>
    `).join('');

    if (!paused) viewer.scrollTop = viewer.scrollHeight;
  }

  function escHtml(s: string): string {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // Initial render
  renderLines(store.get('logs'));

  // Live updates
  const unsub = store.on('logs', (lines) => {
    if (!paused) renderLines(lines);
  });

  // Cleanup on page change
  store.on('activePage', () => unsub());

  container.querySelector('#log-pause')?.addEventListener('click', (e) => {
    paused = !paused;
    (e.target as HTMLButtonElement).textContent = paused ? '▶️ Resume' : '⏸ Pause';
  });

  container.querySelector('#log-clear')?.addEventListener('click', () => {
    store.set('logs', []);
    viewer.innerHTML = '';
  });

  container.querySelector('#log-export')?.addEventListener('click', () => {
    const lines = store.get('logs');
    const text = lines.map(l => `[${new Date(l.ts).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pappybot-logs-${Date.now()}.txt`;
    a.click();
  });

  container.querySelector('#log-filter')?.addEventListener('input', (e) => {
    filter = (e.target as HTMLInputElement).value.toLowerCase();
    renderLines(store.get('logs'));
  });

  container.querySelectorAll('[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-level]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      levelFilter = (btn as HTMLElement).dataset['level']!;
      renderLines(store.get('logs'));
    });
  });
}
