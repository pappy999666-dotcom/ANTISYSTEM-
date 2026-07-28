/**
 * PAPPYBOT V2 — Bridge Page
 */

import { store } from '../stores/store';
import { bridge as api, sessions as sessApi, groups as groupsApi } from '../utils/api';
import { toast } from '../utils/toast';

interface BridgeMsg { text: string; sent: boolean; ts: number; }

export async function renderBridge(container: HTMLElement): Promise<void> {
  const messages: BridgeMsg[] = [];
  let sessionId = store.get('bridgeSessionId') ?? '';
  let groupJid  = store.get('bridgeGroupJid') ?? '';

  const sessions = store.get('sessions');
  const groups   = store.get('groups');

  container.innerHTML = `
    <div class="page-enter" style="height:calc(100vh - var(--header-h) - 1.5rem);display:flex;flex-direction:column">
      <div class="flex items-center justify-between mb-3">
        <h1>🌉 Bridge</h1>
        <div class="flex gap-2">
          <select class="form-select" id="bridge-session" style="width:160px">
            <option value="">Select session</option>
            ${sessions.map(s => `<option value="${s.id}" ${s.id === sessionId ? 'selected' : ''}>${s.label ?? s.id}</option>`).join('')}
          </select>
          <select class="form-select" id="bridge-group" style="width:200px">
            <option value="">Select group</option>
            ${groups.map(g => `<option value="${g.jid}" ${g.jid === groupJid ? 'selected' : ''}>${g.name.slice(0,30)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="bridge-container" style="flex:1">
        <div class="bridge-messages" id="bridge-msgs">
          <div style="text-align:center;color:var(--text-muted);padding:2rem;font-size:0.875rem">
            Select a session and group to start bridging.
          </div>
        </div>
        <div class="bridge-input-bar">
          <label class="btn btn-ghost btn-icon" title="Attach media">
            📎
            <input type="file" id="bridge-file" style="display:none" accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
          </label>
          <textarea class="bridge-input" id="bridge-text" placeholder="Type a message or command..." rows="1"></textarea>
          <button class="btn btn-primary" id="bridge-send">Send</button>
        </div>
      </div>
      <div id="bridge-file-preview" style="display:none;padding:0.5rem 1rem;border-top:1px solid var(--border);font-size:0.8rem;color:var(--text-secondary)"></div>
    </div>
  `;

  let pendingFile: File | null = null;

  const sessSelect  = container.querySelector('#bridge-session') as HTMLSelectElement;
  const groupSelect = container.querySelector('#bridge-group') as HTMLSelectElement;
  const textArea    = container.querySelector('#bridge-text') as HTMLTextAreaElement;
  const sendBtn     = container.querySelector('#bridge-send') as HTMLButtonElement;
  const fileInput   = container.querySelector('#bridge-file') as HTMLInputElement;
  const filePreview = container.querySelector('#bridge-file-preview') as HTMLElement;
  const msgsEl      = container.querySelector('#bridge-msgs') as HTMLElement;

  sessSelect.addEventListener('change', () => { sessionId = sessSelect.value; store.set('bridgeSessionId', sessionId); });
  groupSelect.addEventListener('change', () => { groupJid = groupSelect.value; store.set('bridgeGroupJid', groupJid); });

  fileInput.addEventListener('change', () => {
    pendingFile = fileInput.files?.[0] ?? null;
    if (pendingFile) {
      filePreview.style.display = 'block';
      filePreview.innerHTML = `📎 ${pendingFile.name} (${(pendingFile.size / 1024).toFixed(1)} KB) <button class="btn btn-ghost btn-sm" id="clear-file">✕</button>`;
      filePreview.querySelector('#clear-file')?.addEventListener('click', () => {
        pendingFile = null;
        fileInput.value = '';
        filePreview.style.display = 'none';
      });
    }
  });

  // Auto-resize textarea
  textArea.addEventListener('input', () => {
    textArea.style.height = 'auto';
    textArea.style.height = Math.min(textArea.scrollHeight, 120) + 'px';
  });

  // Send on Enter (Shift+Enter for newline)
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendBtn.click(); }
  });

  sendBtn.addEventListener('click', async () => {
    const text = textArea.value.trim();
    if (!text && !pendingFile) return;
    if (!sessionId || !groupJid) { toast.error('Select a session and group first'); return; }

    sendBtn.disabled = true;
    try {
      await api.send(sessionId, groupJid, text || undefined, pendingFile ?? undefined);
      addMessage(text || `[${pendingFile?.name}]`, true);
      textArea.value = '';
      textArea.style.height = 'auto';
      pendingFile = null;
      fileInput.value = '';
      filePreview.style.display = 'none';
    } catch (err) {
      toast.error(String(err));
    } finally {
      sendBtn.disabled = false;
      textArea.focus();
    }
  });

  function addMessage(text: string, sent: boolean): void {
    messages.push({ text, sent, ts: Date.now() });
    const div = document.createElement('div');
    div.className = `bridge-msg ${sent ? 'sent' : 'received'}`;
    div.innerHTML = `<div>${text}</div><div class="msg-meta">${new Date().toLocaleTimeString()}</div>`;
    msgsEl.appendChild(div);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}
