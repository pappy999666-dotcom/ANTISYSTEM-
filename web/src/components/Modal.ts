/**
 * PAPPYBOT V2 — Modal Component
 */

interface ModalOptions {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  danger?: boolean;
}

export function showModal(opts: ModalOptions): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${opts.title}</h3>
        <button class="btn btn-ghost btn-icon btn-sm" id="modal-close">✕</button>
      </div>
      <div class="modal-body">${opts.body}</div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel">${opts.cancelLabel ?? 'Cancel'}</button>
        <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" id="modal-confirm">
          ${opts.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </div>
  `;

  const close = (): void => {
    overlay.remove();
    opts.onCancel?.();
  };

  overlay.querySelector('#modal-close')?.addEventListener('click', close);
  overlay.querySelector('#modal-cancel')?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#modal-confirm')?.addEventListener('click', async () => {
    const btn = overlay.querySelector('#modal-confirm') as HTMLButtonElement;
    btn.disabled = true;
    btn.textContent = '⏳ Loading...';
    try {
      await opts.onConfirm?.();
      overlay.remove();
    } catch {
      btn.disabled = false;
      btn.textContent = opts.confirmLabel ?? 'Confirm';
    }
  });

  document.body.appendChild(overlay);
}
