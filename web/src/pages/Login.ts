/**
 * PAPPYBOT V2 — Login Page
 */

import { auth as api } from '../utils/api';
import { store } from '../stores/store';
import { toast } from '../utils/toast';

export function renderLogin(container: HTMLElement, onSuccess: () => void): void {
  container.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem">
      <div style="width:100%;max-width:380px">
        <div style="text-align:center;margin-bottom:2rem">
          <div style="width:56px;height:56px;background:linear-gradient(135deg,var(--accent),var(--purple));border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;font-size:1.75rem;margin:0 auto 1rem">⚡</div>
          <h1>PAPPYBOT V2</h1>
          <p class="text-secondary mt-1">Control Panel</p>
        </div>
        <div class="card">
          <h3 class="mb-4">Sign In</h3>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div class="form-group">
              <label class="form-label">Telegram ID</label>
              <input class="form-input" id="login-tid" type="number" placeholder="Your Telegram user ID" />
            </div>
            <div class="form-group">
              <label class="form-label">Access Secret</label>
              <input class="form-input" id="login-secret" type="password" placeholder="Web access secret" />
            </div>
            <button class="btn btn-primary w-full" id="login-btn">Sign In →</button>
            <p class="text-xs text-muted" style="text-align:center">
              Don't have an account? Register via the Telegram bot first.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  const btn = container.querySelector('#login-btn') as HTMLButtonElement;
  const tidInput = container.querySelector('#login-tid') as HTMLInputElement;
  const secretInput = container.querySelector('#login-secret') as HTMLInputElement;

  const doLogin = async (): Promise<void> => {
    const tid = Number(tidInput.value);
    const secret = secretInput.value.trim();
    if (!tid || !secret) { toast.error('Telegram ID and secret required'); return; }

    btn.disabled = true;
    btn.textContent = '⏳ Signing in...';
    try {
      await api.login(tid, secret);
      const me = await api.me();
      store.set('user', { id: me.id, displayName: me.displayName, domain: me.domain, allocatedPort: me.allocatedPort, isOwner: me.isOwner });
      onSuccess();
    } catch (err) {
      toast.error(String(err));
      btn.disabled = false;
      btn.textContent = 'Sign In →';
    }
  };

  btn.addEventListener('click', doLogin);
  secretInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}
