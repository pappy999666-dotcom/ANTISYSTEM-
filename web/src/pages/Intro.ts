/**
 * PAPPYBOT V2 — Intro System Admin Page
 */

import { store } from '../stores/store';
import { intro as api } from '../utils/api';
import { toast } from '../utils/toast';
import { showModal } from '../components/Modal';
import type { IntroConfig, IntroQuestion } from '../utils/api';

export async function renderIntro(container: HTMLElement): Promise<void> {
  const groupJid = store.get('activeGroupJid');
  const groups = store.get('groups');

  container.innerHTML = `
    <div class="page-enter">
      <div class="flex items-center justify-between mb-4">
        <h1>🪪 Intro System</h1>
        <select class="form-select" id="intro-group-select" style="width:240px">
          <option value="">Select a group</option>
          ${groups.map(g => `<option value="${g.jid}" ${g.jid === groupJid ? 'selected' : ''}>${g.name.slice(0,35)}</option>`).join('')}
        </select>
      </div>
      <div id="intro-content">
        <div class="card" style="text-align:center;padding:3rem">
          <div style="font-size:3rem;margin-bottom:1rem">🪪</div>
          <h3>Select a group to configure Intro Cards</h3>
          <p class="text-secondary mt-2">Each group gets its own intro form, questions, and destination.</p>
        </div>
      </div>
    </div>
  `;

  const groupSelect = container.querySelector('#intro-group-select') as HTMLSelectElement;
  groupSelect.addEventListener('change', () => {
    store.set('activeGroupJid', groupSelect.value);
    if (groupSelect.value) loadGroup(groupSelect.value);
  });

  if (groupJid) loadGroup(groupJid);

  async function loadGroup(jid: string): Promise<void> {
    const content = container.querySelector('#intro-content')!;
    content.innerHTML = `<div class="skeleton" style="height:400px;border-radius:var(--radius-lg)"></div>`;

    let config: IntroConfig | null = null;
    try {
      config = await api.getConfig(jid);
    } catch {
      // Not configured yet — show setup
    }

    const sessions = store.get('sessions');
    const sessionId = config?.sessionId ?? sessions[0]?.id ?? '';

    content.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="card">
          <h3 class="mb-4">Configuration</h3>
          <div style="display:flex;flex-direction:column;gap:1rem">
            <div class="flex items-center justify-between">
              <span class="form-label">Enabled</span>
              <label style="cursor:pointer">
                <input type="checkbox" id="intro-enabled" ${config?.enabled ? 'checked' : ''} />
                <span style="margin-left:0.5rem">${config?.enabled ? '✅ Active' : '❌ Inactive'}</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Session</label>
              <select class="form-select" id="intro-session">
                ${sessions.map(s => `<option value="${s.id}" ${s.id === sessionId ? 'selected' : ''}>${s.label ?? s.id}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Welcome Message</label>
              <textarea class="form-textarea" id="intro-welcome">${config?.welcomeMessage ?? 'Welcome! Please fill out this form.'}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Destination Group JID</label>
              <input class="form-input" id="intro-dest" placeholder="e.g. 1234567890-group@g.us" value="${config?.destinationGroupJid ?? ''}" />
            </div>
            <div class="flex gap-2">
              <label style="cursor:pointer;display:flex;align-items:center;gap:0.4rem">
                <input type="checkbox" id="intro-forward" ${config?.forwardEnabled ? 'checked' : ''} />
                <span class="text-sm">Auto-forward</span>
              </label>
              <label style="cursor:pointer;display:flex;align-items:center;gap:0.4rem">
                <input type="checkbox" id="intro-media-req" ${config?.mediaRequired ? 'checked' : ''} />
                <span class="text-sm">Media required</span>
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Max Upload Size (MB)</label>
              <input class="form-input" type="number" id="intro-maxsize" value="${config?.maxUploadSizeMb ?? 10}" min="1" max="50" />
            </div>
            <div class="form-group">
              <label class="form-label">Token Expiry (hours)</label>
              <input class="form-input" type="number" id="intro-expiry" value="${config?.tokenExpiryHours ?? 48}" min="1" max="720" />
            </div>
            <button class="btn btn-primary" id="intro-save">💾 Save Config</button>
          </div>
        </div>
        <div class="card">
          <div class="flex items-center justify-between mb-4">
            <h3>Questions</h3>
            <button class="btn btn-ghost btn-sm" id="intro-add-q">➕ Add</button>
          </div>
          <div id="intro-questions" style="display:flex;flex-direction:column;gap:0.5rem">
            ${(config?.questions ?? []).map(q => renderQuestion(q)).join('')}
          </div>
        </div>
      </div>
      <div class="card mt-4">
        <div class="flex items-center justify-between mb-4">
          <h3>Intro URL</h3>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.75rem">
          <div class="flex gap-2">
            <input class="form-input" id="intro-member-jid" placeholder="Member JID (e.g. 1234567890@s.whatsapp.net)" style="flex:1" />
            <button class="btn btn-primary" id="intro-gen-token">🔗 Generate Token</button>
          </div>
          <div id="intro-token-result" style="display:none" class="card" style="background:var(--accent-dim)">
            <div class="text-sm text-muted mb-1">Intro URL:</div>
            <code id="intro-token-url" class="text-accent"></code>
          </div>
        </div>
      </div>
      <div class="card mt-4">
        <div class="flex items-center justify-between mb-4">
          <h3>Submissions</h3>
          <button class="btn btn-ghost btn-sm" id="intro-load-subs">Load</button>
        </div>
        <div id="intro-submissions"><p class="text-muted text-sm">Click Load to view submissions.</p></div>
      </div>
    `;

    // Save config
    container.querySelector('#intro-save')?.addEventListener('click', async () => {
      const sessId = (container.querySelector('#intro-session') as HTMLSelectElement).value;
      try {
        await api.setConfig(jid, sessId, {
          enabled: (container.querySelector('#intro-enabled') as HTMLInputElement).checked,
          welcomeMessage: (container.querySelector('#intro-welcome') as HTMLTextAreaElement).value,
          destinationGroupJid: (container.querySelector('#intro-dest') as HTMLInputElement).value || undefined,
          forwardEnabled: (container.querySelector('#intro-forward') as HTMLInputElement).checked,
          mediaRequired: (container.querySelector('#intro-media-req') as HTMLInputElement).checked,
          maxUploadSizeMb: Number((container.querySelector('#intro-maxsize') as HTMLInputElement).value),
          tokenExpiryHours: Number((container.querySelector('#intro-expiry') as HTMLInputElement).value),
        });
        toast.success('Intro config saved');
      } catch (err) { toast.error(String(err)); }
    });

    // Add question
    container.querySelector('#intro-add-q')?.addEventListener('click', () => {
      showModal({
        title: '➕ Add Question',
        body: `
          <div class="form-group"><label class="form-label">Question Label</label><input class="form-input" id="q-label" placeholder="e.g. Your Name" /></div>
          <div class="form-group"><label class="form-label">Type</label>
            <select class="form-select" id="q-type">
              <option value="short">Short Answer</option>
              <option value="paragraph">Paragraph</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="checkbox">Checkbox</option>
            </select>
          </div>
          <div class="form-group"><label style="cursor:pointer;display:flex;align-items:center;gap:0.4rem"><input type="checkbox" id="q-required" checked /><span>Required</span></label></div>
        `,
        confirmLabel: 'Add Question',
        onConfirm: async () => {
          const label = (document.getElementById('q-label') as HTMLInputElement).value.trim();
          const type = (document.getElementById('q-type') as HTMLSelectElement).value as IntroQuestion['type'];
          const required = (document.getElementById('q-required') as HTMLInputElement).checked;
          if (!label) { toast.error('Label required'); return; }
          const sessId = (container.querySelector('#intro-session') as HTMLSelectElement).value;
          if (!config) await api.setConfig(jid, sessId, {});
          await api.addQuestion(jid, { label, type, required, order: 999 });
          toast.success('Question added');
          loadGroup(jid);
        },
      });
    });

    // Generate token
    container.querySelector('#intro-gen-token')?.addEventListener('click', async () => {
      const memberJid = (container.querySelector('#intro-member-jid') as HTMLInputElement).value.trim();
      if (!memberJid) { toast.error('Member JID required'); return; }
      const sessId = (container.querySelector('#intro-session') as HTMLSelectElement).value;
      try {
        const { token } = await api.generateToken(jid, sessId, memberJid);
        const domain = store.get('user')?.domain ?? location.origin;
        const url = `${domain}/intro.html?token=${token}`;
        const resultEl = container.querySelector('#intro-token-result') as HTMLElement;
        const urlEl = container.querySelector('#intro-token-url') as HTMLElement;
        resultEl.style.display = 'block';
        urlEl.textContent = url;
        toast.success('Token generated');
      } catch (err) { toast.error(String(err)); }
    });

    // Load submissions
    container.querySelector('#intro-load-subs')?.addEventListener('click', async () => {
      try {
        const subs = await api.submissions(jid);
        const el = container.querySelector('#intro-submissions')!;
        el.innerHTML = subs.length
          ? subs.map(s => `
            <div class="flex items-center justify-between" style="padding:0.5rem 0;border-bottom:1px solid var(--border)">
              <div>
                <div class="text-sm">${s.memberJid.split('@')[0]}</div>
                <div class="text-xs text-muted">${new Date(s.submittedAt).toLocaleString()} · ${s.forwarded ? '✅ Forwarded' : '⏳ Pending'}</div>
              </div>
              ${!s.forwarded ? `<button class="btn btn-ghost btn-sm" data-fwd="${s.id}">📤 Forward</button>` : ''}
            </div>
          `).join('')
          : '<p class="text-muted text-sm">No submissions yet.</p>';

        el.querySelectorAll('[data-fwd]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await api.forwardSubmission((btn as HTMLElement).dataset['fwd']!);
              toast.success('Forwarded');
              (btn as HTMLElement).remove();
            } catch (err) { toast.error(String(err)); }
          });
        });
      } catch (err) { toast.error(String(err)); }
    });

    // Delete question buttons
    container.querySelectorAll('[data-del-q]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qid = (btn as HTMLElement).dataset['delQ']!;
        try {
          await api.deleteQuestion(jid, qid);
          toast.success('Question deleted');
          loadGroup(jid);
        } catch (err) { toast.error(String(err)); }
      });
    });
  }

  function renderQuestion(q: IntroQuestion): string {
    return `
      <div class="flex items-center gap-2" style="padding:0.5rem;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border)">
        <span style="color:var(--text-muted);font-size:0.75rem">#${q.order + 1}</span>
        <div style="flex:1">
          <div class="text-sm">${q.label}</div>
          <div class="text-xs text-muted">${q.type} · ${q.required ? 'Required' : 'Optional'}</div>
        </div>
        <button class="btn btn-danger btn-sm" data-del-q="${q.id}">🗑</button>
      </div>
    `;
  }
}
