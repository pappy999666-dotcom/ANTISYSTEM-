/**
 * PAPPYBOT V2 — API Client
 * Typed fetch wrapper for all REST endpoints.
 */

const BASE = '/api';

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isFormData = false
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body && !isFormData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

const get  = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body);
const put  = <T>(path: string, body?: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body);
const del  = <T>(path: string) => request<T>('DELETE', path);
const postForm = <T>(path: string, form: FormData) => request<T>('POST', path, form, true);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login: (telegramId: number, secret: string) =>
    post<{ ok: boolean; user: { id: number; displayName: string } }>('/auth/login', { telegramId, secret }),
  logout: () => post<{ ok: boolean }>('/auth/logout'),
  me: () => get<{
    id: string; displayName: string; domain?: string;
    allocatedPort: number; isOwner: boolean; commandPrefix: string;
  }>('/auth/me'),
};

// ── Sessions ──────────────────────────────────────────────────────────────────
export const sessions = {
  list: () => get<SessionInfo[]>('/sessions'),
  get: (id: string) => get<SessionInfo>(`/sessions/${encodeURIComponent(id)}`),
  create: (id: string, label?: string) => post<{ ok: boolean; sessionId: string }>('/sessions', { id, label }),
  reconnect: (id: string) => post<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}/reconnect`),
  logout: (id: string) => post<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}/logout`),
  delete: (id: string) => del<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}`),
  rename: (id: string, label: string) => patch<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}`, { label }),
};

// ── Groups ────────────────────────────────────────────────────────────────────
export const groups = {
  list: () => get<GroupInfo[]>('/groups'),
  get: (jid: string) => get<GroupInfo>(`/groups/${encodeURIComponent(jid)}`),
  participants: (jid: string) => get<Participant[]>(`/groups/${encodeURIComponent(jid)}/participants`),
  refresh: (jid: string, sessionId: string) =>
    post<{ ok: boolean }>(`/groups/${encodeURIComponent(jid)}/refresh`, { sessionId }),
};

// ── Runtime ───────────────────────────────────────────────────────────────────
export const runtime = {
  snapshot: () => get<RuntimeSnapshot>('/runtime/snapshot'),
  users: () => get<UserRecord[]>('/runtime/users'),
  banUser: (id: number) => post<{ ok: boolean }>(`/runtime/users/${id}/ban`),
  unbanUser: (id: number) => post<{ ok: boolean }>(`/runtime/users/${id}/unban`),
  maintenance: () => get<{ enabled: boolean }>('/runtime/maintenance'),
  setMaintenance: (enabled: boolean) => post<{ ok: boolean }>('/runtime/maintenance', { enabled }),
};

// ── Intro ─────────────────────────────────────────────────────────────────────
export const intro = {
  getConfig: (groupJid: string) => get<IntroConfig>(`/intro/${encodeURIComponent(groupJid)}/config`),
  setConfig: (groupJid: string, sessionId: string, patch: Partial<IntroConfig>) =>
    put<IntroConfig>(`/intro/${encodeURIComponent(groupJid)}/config`, { sessionId, ...patch }),
  addQuestion: (groupJid: string, q: Omit<IntroQuestion, 'id'>) =>
    post<IntroQuestion>(`/intro/${encodeURIComponent(groupJid)}/questions`, q),
  updateQuestion: (groupJid: string, qid: string, patch: Partial<IntroQuestion>) =>
    patch<{ ok: boolean }>(`/intro/${encodeURIComponent(groupJid)}/questions/${qid}`, patch),
  deleteQuestion: (groupJid: string, qid: string) =>
    del<{ ok: boolean }>(`/intro/${encodeURIComponent(groupJid)}/questions/${qid}`),
  reorderQuestions: (groupJid: string, orderedIds: string[]) =>
    post<{ ok: boolean }>(`/intro/${encodeURIComponent(groupJid)}/questions/reorder`, { orderedIds }),
  generateToken: (groupJid: string, sessionId: string, memberJid: string) =>
    post<{ token: string; expiresAt: number }>(`/intro/${encodeURIComponent(groupJid)}/token`, { sessionId, memberJid }),
  setDestination: (groupJid: string, sessionId: string, destinationJid: string) =>
    post<{ ok: boolean }>(`/intro/${encodeURIComponent(groupJid)}/destination`, { sessionId, destinationJid }),
  submissions: (groupJid: string) => get<IntroSubmission[]>(`/intro/${encodeURIComponent(groupJid)}/submissions`),
  forwardSubmission: (id: string) => post<{ ok: boolean }>(`/intro/submissions/${id}/forward`),
  // Public (token-based)
  getForm: (token: string) => get<IntroForm>(`/intro/form/${token}`),
  uploadMedia: (token: string, file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return postForm<{ id: string; name: string; size: number; mime: string }>(`/intro/upload/${token}`, fd);
  },
  submit: (token: string, answers: Record<string, string | string[]>, mediaFiles: string[]) =>
    post<{ ok: boolean; submissionId: string }>(`/intro/submit/${token}`, { answers, mediaFiles }),
};

// ── Bridge ────────────────────────────────────────────────────────────────────
export const bridge = {
  send: (sessionId: string, groupJid: string, text?: string, media?: File, mediaType?: string) => {
    const fd = new FormData();
    fd.append('sessionId', sessionId);
    fd.append('groupJid', groupJid);
    if (text) fd.append('text', text);
    if (media) { fd.append('media', media); if (mediaType) fd.append('mediaType', mediaType); }
    return postForm<{ ok: boolean }>('/bridge/send', fd);
  },
  commands: () => get<CommandInfo[]>('/bridge/commands'),
};

// ── Upload ────────────────────────────────────────────────────────────────────
export const upload = {
  upload: (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    return postForm<{ id: string; name: string; size: number; mime: string }>('/upload', fd);
  },
};

// ── Report ────────────────────────────────────────────────────────────────────
export const report = {
  submit: (message: string, files: File[], whatsappNumber?: string, name?: string) => {
    const fd = new FormData();
    fd.append('message', message);
    if (whatsappNumber) fd.append('whatsappNumber', whatsappNumber);
    if (name) fd.append('name', name);
    files.forEach(f => fd.append('files', f));
    return postForm<{ ok: boolean; id: string }>('/report', fd);
  },
  list: () => get<ReportRecord[]>('/report'),
  setDestination: (sessionId: string, groupJid: string) =>
    post<{ ok: boolean }>('/report/destination', { sessionId, groupJid }),
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SessionInfo {
  id: string; label?: string; owner: string; status: string;
  phoneNumber?: string; displayName?: string; connectedAt?: string;
  reconnectAttempts: number; commandPrefix?: string;
}
export interface GroupInfo {
  jid: string; name: string; description?: string;
  memberCount: number; adminCount: number;
  announce: boolean; restrict: boolean; inviteCode?: string;
  participants?: Participant[];
}
export interface Participant { jid: string; isAdmin: boolean; isSuperAdmin: boolean; }
export interface RuntimeSnapshot {
  capturedAt: string; sessions: SessionStat[]; memory: MemoryInfo;
  throughput: Throughput; totalReconnects: number; activeSockets: number; uptimeMs: number;
}
export interface SessionStat {
  sessionId: string; status: string; phoneNumber?: string;
  displayName?: string; uptimeMs: number; reconnectAttempts: number;
}
export interface MemoryInfo { rss: number; heapUsed: number; heapTotal: number; external: number; }
export interface Throughput { messagesReceived: number; messagesSent: number; commandsExecuted: number; commandErrors: number; eventsEmitted: number; }
export interface UserRecord { telegramId: number; displayName: string; domain?: string; allocatedPort: number; isBanned: boolean; registeredAt: number; lastActiveAt: number; }
export interface IntroConfig {
  groupJid: string; sessionId: string; enabled: boolean; welcomeMessage: string;
  questions: IntroQuestion[]; destinationGroupJid?: string; forwardEnabled: boolean;
  mediaRequired: boolean; approvalRequired: boolean; maxUploadSizeMb: number;
  allowedFileTypes: string[]; tokenExpiryHours: number;
}
export interface IntroQuestion {
  id: string; label: string; type: 'short' | 'paragraph' | 'multiple_choice' | 'checkbox';
  required: boolean; options?: string[]; order: number;
}
export interface IntroForm {
  groupJid: string; welcomeMessage: string; questions: IntroQuestion[];
  mediaRequired: boolean; maxUploadSizeMb: number; allowedFileTypes: string[]; expiresAt: number;
}
export interface IntroSubmission {
  id: string; token: string; groupJid: string; memberJid: string;
  answers: Record<string, string | string[]>; mediaFiles: string[];
  submittedAt: number; forwarded: boolean;
}
export interface CommandInfo { name: string; description: string; usage?: string; category: string; aliases?: string[]; }
export interface ReportRecord { id: string; message: string; submittedAt: number; forwarded: boolean; }
