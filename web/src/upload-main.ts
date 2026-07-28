/**
 * PAPPYBOT V2 — Public Anonymous Upload / Report Page
 */

import './styles/global.css';
import { report as api } from './utils/api';
import { toast } from './utils/toast';

const appEl = document.getElementById('app')!;
const uploadedFiles: File[] = [];

appEl.innerHTML = `
  <div class="intro-page">
    <div class="intro-card">
      <div class="intro-header">
        <div class="intro-group-avatar">📬</div>
        <h2>Anonymous Upload</h2>
        <p class="text-secondary mt-1">Submit a report, confession, or media anonymously.</p>
      </div>
      <div class="intro-body">
        <div class="form-group">
          <label class="form-label">WhatsApp Number <span class="text-muted">(optional)</span></label>
          <input class="form-input" id="wa-number" placeholder="+1234567890" />
        </div>
        <div class="form-group">
          <label class="form-label">Name <span class="text-muted">(optional)</span></label>
          <input class="form-input" id="anon-name" placeholder="Anonymous" />
        </div>
        <div class="form-group">
          <label class="form-label">Message <span style="color:var(--red)">*</span></label>
          <textarea class="form-textarea" id="anon-msg" placeholder="Write your message..." style="min-height:120px"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Attachments <span class="text-muted">(optional, max 5)</span></label>
          <div class="upload-zone" id="upload-zone">
            <div class="upload-icon">📎</div>
            <div class="upload-label">Click or drag files here</div>
            <div class="upload-hint">Images, Videos, Documents · Max 20MB each</div>
            <input type="file" id="upload-input" style="display:none" multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx" />
          </div>
          <div id="file-list" style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.5rem"></div>
        </div>
      </div>
      <div class="intro-footer">
        <button class="btn btn-primary w-full" id="submit-btn">Submit Anonymously</button>
      </div>
    </div>
  </div>
`;

const zone = document.getElementById('upload-zone') as HTMLElement;
const input = document.getElementById('upload-input') as HTMLInputElement;
const fileList = document.getElementById('file-list') as HTMLElement;

zone.addEventListener('click', () => input.click());
zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); addFiles(e.dataTransfer?.files); });
input.addEventListener('change', () => addFiles(input.files));

function addFiles(files?: FileList | null): void {
  if (!files) return;
  for (const f of Array.from(files)) {
    if (uploadedFiles.length >= 5) { toast.error('Max 5 files'); break; }
    uploadedFiles.push(f);
  }
  renderFileList();
}

function renderFileList(): void {
  fileList.innerHTML = uploadedFiles.map((f, i) => `
    <div class="flex items-center gap-2" style="padding:0.4rem;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border)">
      <span class="text-sm" style="flex:1">${f.name}</span>
      <span class="text-xs text-muted">${(f.size / 1024).toFixed(0)} KB</span>
      <button class="btn btn-ghost btn-sm" data-remove="${i}">✕</button>
    </div>
  `).join('');

  fileList.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      uploadedFiles.splice(Number((btn as HTMLElement).dataset['remove']), 1);
      renderFileList();
    });
  });
}

document.getElementById('submit-btn')?.addEventListener('click', async () => {
  const msg = (document.getElementById('anon-msg') as HTMLTextAreaElement).value.trim();
  if (!msg) { toast.error('Message is required'); return; }

  const btn = document.getElementById('submit-btn') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = '⏳ Submitting...';

  try {
    const waNumber = (document.getElementById('wa-number') as HTMLInputElement).value.trim() || undefined;
    const name = (document.getElementById('anon-name') as HTMLInputElement).value.trim() || undefined;
    await api.submit(msg, uploadedFiles, waNumber, name);

    appEl.innerHTML = `
      <div class="intro-page">
        <div class="intro-card">
          <div class="intro-header" style="padding:3rem">
            <div class="intro-group-avatar">✅</div>
            <h2>Submitted!</h2>
            <p class="text-secondary mt-2">Your anonymous submission has been received.</p>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    toast.error(String(err));
    btn.disabled = false;
    btn.textContent = 'Submit Anonymously';
  }
});
