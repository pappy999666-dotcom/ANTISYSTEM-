/**
 * PAPPYBOT V2 — Toast Notifications
 */

type ToastType = 'success' | 'error' | 'info' | 'warning';

const ICONS: Record<ToastType, string> = {
  success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️',
};

function getContainer(): HTMLElement {
  let el = document.getElementById('toast-container');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast-container';
    el.className = 'toast-container';
    document.body.appendChild(el);
  }
  return el;
}

function show(message: string, type: ToastType, duration = 3500): void {
  const container = getContainer();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${ICONS[type]}</span><span>${message}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 220);
  }, duration);
}

export const toast = {
  success: (msg: string) => show(msg, 'success'),
  error:   (msg: string) => show(msg, 'error'),
  info:    (msg: string) => show(msg, 'info'),
  warning: (msg: string) => show(msg, 'warning'),
};
