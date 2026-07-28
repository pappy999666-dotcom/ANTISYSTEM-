/**
 * PAPPYBOT V2 — Public Intro Card Page
 */

import './styles/global.css';
import { intro as api } from './utils/api';
import { toast } from './utils/toast';
import type { IntroForm, IntroQuestion } from './utils/api';

const appEl = document.getElementById('app')!;
const token = new URLSearchParams(location.search).get('token') ?? '';

async function boot(): Promise<void> {
  if (!token) {
    renderError('No token provided. Please use the link sent to you.');
    return;
  }

  appEl.innerHTML = `<div class="intro-page"><div class="intro-card"><div style="padding:2rem;text-align:center"><div class="skeleton" style="height:200px;border-radius:var(--radius-lg)"></div></div></div></div>`;

  try {
    const form = await api.getForm(token);
    renderForm(form);
  } catch (err) {
    renderError(String(err));
  }
}

function renderError(msg: string): void {
  appEl.innerHTML = `
    <div class="intro-page">
      <div class="intro-card">
        <div class="intro-header">
          <div class="intro-group-avatar">❌</div>
          <h2>Link Unavailable</h2>
          <p class="text-secondary mt-2">${msg}</p>
        </div>
      </div>
    </div>
  `;
}

function renderForm(form: IntroForm): void {
  const answers: Record<string, string | string[]> = {};
  const uploadedFiles: string[] = [];
  let currentStep = 0;
  const totalSteps = form.questions.length + (form.mediaRequired ? 1 : 0) + 1; // +1 for review

  function renderStep(): void {
    const progress = Math.round((currentStep / totalSteps) * 100);

    if (currentStep < form.questions.length) {
      renderQuestion(form.questions[currentStep]!, progress);
    } else if (form.mediaRequired && currentStep === form.questions.length) {
      renderUpload(progress);
    } else {
      renderReview(progress);
    }
  }

  function renderQuestion(q: IntroQuestion, progress: number): void {
    appEl.innerHTML = `
      <div class="intro-page">
        <div class="intro-card">
          <div class="intro-header">
            <div class="intro-group-avatar">🪪</div>
            <h2>Intro Card</h2>
            <p class="text-secondary mt-1">${form.welcomeMessage}</p>
          </div>
          <div class="intro-progress"><div class="intro-progress-bar" style="width:${progress}%"></div></div>
          <div class="intro-body">
            <div style="font-size:0.75rem;color:var(--text-muted)">Question ${currentStep + 1} of ${form.questions.length}</div>
            <div class="form-group">
              <label class="form-label">${q.label} ${q.required ? '<span style="color:var(--red)">*</span>' : ''}</label>
              ${renderInput(q)}
            </div>
          </div>
          <div class="intro-footer">
            ${currentStep > 0 ? '<button class="btn btn-ghost" id="intro-back">← Back</button>' : ''}
            <button class="btn btn-primary" style="margin-left:auto" id="intro-next">
              ${currentStep < form.questions.length - 1 ? 'Next →' : form.mediaRequired ? 'Upload Media →' : 'Review →'}
            </button>
          </div>
        </div>
      </div>
    `;

    appEl.querySelector('#intro-back')?.addEventListener('click', () => { currentStep--; renderStep(); });
    appEl.querySelector('#intro-next')?.addEventListener('click', () => {
      const val = getInputValue(q);
      if (q.required && (!val || (Array.isArray(val) && !val.length))) {
        toast.error('This question is required');
        return;
      }
      answers[q.id] = val;
      currentStep++;
      renderStep();
    });
  }

  function renderInput(q: IntroQuestion): string {
    const existing = answers[q.id];
    if (q.type === 'short') return `<input class="form-input" id="q-input" value="${existing ?? ''}" placeholder="Your answer..." />`;
    if (q.type === 'paragraph') return `<textarea class="form-textarea" id="q-input" placeholder="Your answer...">${existing ?? ''}</textarea>`;
    if (q.type === 'multiple_choice') return (q.options ?? []).map(opt => `
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.4rem">
        <input type="radio" name="q-radio" value="${opt}" ${existing === opt ? 'checked' : ''} /> ${opt}
      </label>`).join('');
    if (q.type === 'checkbox') return (q.options ?? []).map(opt => `
      <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;padding:0.5rem;border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.4rem">
        <input type="checkbox" name="q-check" value="${opt}" ${(existing as string[] ?? []).includes(opt) ? 'checked' : ''} /> ${opt}
      </label>`).join('');
    return '';
  }

  function getInputValue(q: IntroQuestion): string | string[] {
    if (q.type === 'short' || q.type === 'paragraph') {
      return (document.getElementById('q-input') as HTMLInputElement | HTMLTextAreaElement)?.value ?? '';
    }
    if (q.type === 'multiple_choice') {
      return (document.querySelector('input[name="q-radio"]:checked') as HTMLInputElement)?.value ?? '';
    }
    if (q.type === 'checkbox') {
      return [...document.querySelectorAll('input[name="q-check"]:checked')].map(el => (el as HTMLInputElement).value);
    }
    return '';
  }

  function renderUpload(progress: number): void {
    appEl.innerHTML = `
      <div class="intro-page">
        <div class="intro-card">
          <div class="intro-header">
            <div class="intro-group-avatar">📎</div>
            <h2>Upload Media</h2>
            <p class="text-secondary mt-1">Please upload a photo or video of yourself.</p>
          </div>
          <div class="intro-progress"><div class="intro-progress-bar" style="width:${progress}%"></div></div>
          <div class="intro-body">
            <div class="upload-zone" id="upload-zone">
              <div class="upload-icon">📸</div>
              <div class="upload-label">Click or drag to upload</div>
              <div class="upload-hint">Max ${form.maxUploadSizeMb}MB · Images, Videos, Audio, Documents</div>
              <input type="file" id="upload-input" style="display:none" accept="${form.allowedFileTypes.join(',')}" />
            </div>
            <div id="upload-status"></div>
          </div>
          <div class="intro-footer">
            <button class="btn btn-ghost" id="intro-back">← Back</button>
            <button class="btn btn-primary" style="margin-left:auto" id="intro-next" ${uploadedFiles.length === 0 ? 'disabled' : ''}>Review →</button>
          </div>
        </div>
      </div>
    `;

    const zone = appEl.querySelector('#upload-zone') as HTMLElement;
    const input = appEl.querySelector('#upload-input') as HTMLInputElement;
    const status = appEl.querySelector('#upload-status') as HTMLElement;
    const nextBtn = appEl.querySelector('#intro-next') as HTMLButtonElement;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('drag-over'); handleFile(e.dataTransfer?.files[0]); });
    input.addEventListener('change', () => handleFile(input.files?.[0]));

    async function handleFile(file?: File): Promise<void> {
      if (!file) return;
      status.innerHTML = `<p class="text-sm text-muted">⏳ Uploading ${file.name}...</p>`;
      try {
        const result = await api.uploadMedia(token, file);
        uploadedFiles.push(result.id);
        status.innerHTML = `<p class="text-sm text-green">✅ ${file.name} uploaded</p>`;
        nextBtn.disabled = false;
      } catch (err) {
        status.innerHTML = `<p class="text-sm text-red">❌ ${String(err)}</p>`;
      }
    }

    appEl.querySelector('#intro-back')?.addEventListener('click', () => { currentStep--; renderStep(); });
    nextBtn.addEventListener('click', () => { currentStep++; renderStep(); });
  }

  function renderReview(progress: number): void {
    appEl.innerHTML = `
      <div class="intro-page">
        <div class="intro-card">
          <div class="intro-header">
            <div class="intro-group-avatar">✅</div>
            <h2>Review & Submit</h2>
            <p class="text-secondary mt-1">Please review your answers before submitting.</p>
          </div>
          <div class="intro-progress"><div class="intro-progress-bar" style="width:${progress}%"></div></div>
          <div class="intro-body">
            ${form.questions.map(q => `
              <div style="padding:0.75rem;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div class="text-xs text-muted mb-1">${q.label}</div>
                <div class="text-sm">${Array.isArray(answers[q.id]) ? (answers[q.id] as string[]).join(', ') : (answers[q.id] ?? '—')}</div>
              </div>
            `).join('')}
            ${uploadedFiles.length ? `<div class="text-sm text-green">📎 ${uploadedFiles.length} file(s) uploaded</div>` : ''}
          </div>
          <div class="intro-footer">
            <button class="btn btn-ghost" id="intro-back">← Edit</button>
            <button class="btn btn-primary" style="margin-left:auto" id="intro-submit">Submit ✓</button>
          </div>
        </div>
      </div>
    `;

    appEl.querySelector('#intro-back')?.addEventListener('click', () => { currentStep--; renderStep(); });
    appEl.querySelector('#intro-submit')?.addEventListener('click', async () => {
      const btn = appEl.querySelector('#intro-submit') as HTMLButtonElement;
      btn.disabled = true;
      btn.textContent = '⏳ Submitting...';
      try {
        await api.submit(token, answers, uploadedFiles);
        appEl.innerHTML = `
          <div class="intro-page">
            <div class="intro-card">
              <div class="intro-header" style="padding:3rem">
                <div class="intro-group-avatar">🎉</div>
                <h2>Submitted!</h2>
                <p class="text-secondary mt-2">Your intro has been submitted successfully. Welcome to the group!</p>
              </div>
            </div>
          </div>
        `;
      } catch (err) {
        toast.error(String(err));
        btn.disabled = false;
        btn.textContent = 'Submit ✓';
      }
    });
  }

  renderStep();
}

boot();
