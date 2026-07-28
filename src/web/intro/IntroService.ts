/**
 * PAPPYBOT V2 — Intro Service
 *
 * Manages Intro Card configurations, secure tokens, form submissions,
 * and forwarding to destination WhatsApp groups.
 * Never calls the socket directly — uses SocketManager.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type {
  IntroGroupConfig,
  IntroToken,
  IntroSubmission,
  IntroQuestion,
} from '../types/Web';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import { storageService } from '../storage/StorageService';
import { logger } from '../../logger/Logger';

const log = logger.child('IntroService');
const STORE_PATH = path.resolve('storage/intro_store.json');

interface IntroStore {
  configs: Record<string, IntroGroupConfig>;
  tokens: Record<string, IntroToken>;
  submissions: Record<string, IntroSubmission>;
}

const DEFAULT_QUESTIONS: IntroQuestion[] = [
  { id: 'name', label: 'Your Name', type: 'short', required: true, order: 0 },
  { id: 'age', label: 'Your Age', type: 'short', required: true, order: 1 },
  { id: 'location', label: 'Your Location', type: 'short', required: false, order: 2 },
];

export class IntroService {
  private configs = new Map<string, IntroGroupConfig>();
  private tokens = new Map<string, IntroToken>();
  private submissions = new Map<string, IntroSubmission>();

  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache
  ) {
    this.load();
  }

  // ── Config ────────────────────────────────────────────────────────────────

  getConfig(groupJid: string): IntroGroupConfig | undefined {
    return this.configs.get(groupJid);
  }

  setConfig(groupJid: string, sessionId: string, patch: Partial<IntroGroupConfig>): IntroGroupConfig {
    const existing = this.configs.get(groupJid);
    const config: IntroGroupConfig = {
      groupJid,
      sessionId,
      enabled: false,
      welcomeMessage: 'Welcome! Please fill out this form to introduce yourself.',
      questions: DEFAULT_QUESTIONS,
      forwardEnabled: false,
      mediaRequired: false,
      approvalRequired: false,
      maxUploadSizeMb: 10,
      allowedFileTypes: ['image/', 'video/', 'audio/', 'application/pdf'],
      tokenExpiryHours: 48,
      updatedAt: Date.now(),
      ...(existing ?? {}),
      ...(patch ?? {}),
    };
    this.configs.set(groupJid, config);
    this.save();
    return config;
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  addQuestion(groupJid: string, question: Omit<IntroQuestion, 'id'>): IntroQuestion {
    const config = this.configs.get(groupJid);
    if (!config) throw new Error('Group not configured');
    const q: IntroQuestion = { ...question, id: uuidv4() };
    config.questions.push(q);
    config.questions.sort((a, b) => a.order - b.order);
    config.updatedAt = Date.now();
    this.save();
    return q;
  }

  updateQuestion(groupJid: string, questionId: string, patch: Partial<IntroQuestion>): void {
    const config = this.configs.get(groupJid);
    if (!config) throw new Error('Group not configured');
    const q = config.questions.find(q => q.id === questionId);
    if (!q) throw new Error('Question not found');
    Object.assign(q, patch);
    config.updatedAt = Date.now();
    this.save();
  }

  deleteQuestion(groupJid: string, questionId: string): void {
    const config = this.configs.get(groupJid);
    if (!config) throw new Error('Group not configured');
    config.questions = config.questions.filter(q => q.id !== questionId);
    config.updatedAt = Date.now();
    this.save();
  }

  reorderQuestions(groupJid: string, orderedIds: string[]): void {
    const config = this.configs.get(groupJid);
    if (!config) throw new Error('Group not configured');
    orderedIds.forEach((id, idx) => {
      const q = config.questions.find(q => q.id === id);
      if (q) q.order = idx;
    });
    config.questions.sort((a, b) => a.order - b.order);
    config.updatedAt = Date.now();
    this.save();
  }

  // ── Tokens ────────────────────────────────────────────────────────────────

  generateToken(groupJid: string, sessionId: string, memberJid: string): IntroToken {
    const config = this.configs.get(groupJid);
    const expiryHours = config?.tokenExpiryHours ?? 48;
    const token: IntroToken = {
      token: crypto.randomBytes(32).toString('hex'),
      groupJid,
      sessionId,
      memberJid,
      createdAt: Date.now(),
      expiresAt: Date.now() + expiryHours * 3600_000,
      used: false,
    };
    this.tokens.set(token.token, token);
    this.save();
    return token;
  }

  getToken(token: string): IntroToken | undefined {
    const t = this.tokens.get(token);
    if (!t) return undefined;
    if (Date.now() > t.expiresAt) return undefined; // expired
    return t;
  }

  markTokenUsed(token: string): void {
    const t = this.tokens.get(token);
    if (t) { t.used = true; this.save(); }
  }

  // ── Submissions ───────────────────────────────────────────────────────────

  async submit(
    token: string,
    answers: Record<string, string | string[]>,
    mediaFileIds: string[]
  ): Promise<IntroSubmission> {
    const t = this.getToken(token);
    if (!t) throw new Error('Invalid or expired token');
    if (t.used) throw new Error('Token already used');

    const submission: IntroSubmission = {
      id: uuidv4(),
      token,
      groupJid: t.groupJid,
      sessionId: t.sessionId,
      memberJid: t.memberJid,
      answers,
      mediaFiles: mediaFileIds,
      submittedAt: Date.now(),
      forwarded: false,
    };

    this.submissions.set(submission.id, submission);
    this.markTokenUsed(token);
    this.save();

    // Auto-forward if configured
    const config = this.configs.get(t.groupJid);
    if (config?.forwardEnabled && config.destinationGroupJid) {
      await this.forwardSubmission(submission.id).catch(err =>
        log.warn('Auto-forward failed', { id: submission.id, error: String(err) })
      );
    }

    log.info('Intro submitted', { id: submission.id, groupJid: t.groupJid });
    return submission;
  }

  getSubmission(id: string): IntroSubmission | undefined {
    return this.submissions.get(id);
  }

  getSubmissionsForGroup(groupJid: string): IntroSubmission[] {
    return [...this.submissions.values()].filter(s => s.groupJid === groupJid);
  }

  // ── Forward ───────────────────────────────────────────────────────────────

  async forwardSubmission(submissionId: string): Promise<void> {
    const sub = this.submissions.get(submissionId);
    if (!sub) throw new Error('Submission not found');

    const config = this.configs.get(sub.groupJid);
    if (!config?.destinationGroupJid) throw new Error('No destination group configured');

    const sock = this.socketManager.getSocket(sub.sessionId);
    if (!sock) throw new Error('Session not connected');

    const group = this.groupCache.get(sub.groupJid);
    const groupName = group?.subject ?? sub.groupJid;

    // Build text card
    const lines = [
      `📋 *Intro Card*`,
      `Group: ${groupName}`,
      `Member: ${sub.memberJid.split('@')[0]}`,
      `Submitted: ${new Date(sub.submittedAt).toISOString()}`,
      `ID: ${sub.id}`,
      ``,
      `*Answers:*`,
      ...Object.entries(sub.answers).map(([k, v]) =>
        `• ${k}: ${Array.isArray(v) ? v.join(', ') : v}`
      ),
    ];

    await sock.sendMessage(config.destinationGroupJid, { text: lines.join('\n') });

    // Forward media files
    for (const fileId of sub.mediaFiles) {
      const filePath = storageService.getPath(fileId);
      if (!filePath) continue;
      const buf = fs.readFileSync(filePath);
      const record = storageService.get(fileId);
      const mime = record?.mimeType ?? 'application/octet-stream';

      if (mime.startsWith('image/')) {
        await sock.sendMessage(config.destinationGroupJid, { image: buf, caption: `Media from ${sub.id}` });
      } else if (mime.startsWith('video/')) {
        await sock.sendMessage(config.destinationGroupJid, { video: buf, caption: `Media from ${sub.id}` });
      } else if (mime.startsWith('audio/')) {
        await sock.sendMessage(config.destinationGroupJid, { audio: buf });
      } else {
        await sock.sendMessage(config.destinationGroupJid, {
          document: buf,
          fileName: record?.originalName ?? 'file',
          mimetype: mime,
        });
      }
    }

    sub.forwarded = true;
    this.save();
    log.info('Intro forwarded', { submissionId, destination: config.destinationGroupJid });
  }

  // ── Destination group validation ──────────────────────────────────────────

  async setDestination(groupJid: string, sessionId: string, destinationJid: string): Promise<void> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) throw new Error('Session not connected');

    // Verify bot is in the destination group
    const destMeta = this.groupCache.get(destinationJid);
    if (!destMeta) {
      // Try fetching
      try {
        await sock.groupMetadata(destinationJid);
      } catch {
        throw new Error('Bot is not in the destination group or group does not exist');
      }
    }

    this.setConfig(groupJid, sessionId, { destinationGroupJid: destinationJid });
    log.info('Intro destination set', { groupJid, destinationJid });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  private save(): void {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      const data: IntroStore = {
        configs: Object.fromEntries(this.configs),
        tokens: Object.fromEntries(this.tokens),
        submissions: Object.fromEntries(this.submissions),
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
      log.warn('Failed to save intro store', { error: String(err) });
    }
  }

  private load(): void {
    try {
      if (!fs.existsSync(STORE_PATH)) return;
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as IntroStore;
      for (const [k, v] of Object.entries(data.configs ?? {})) this.configs.set(k, v as IntroGroupConfig);
      for (const [k, v] of Object.entries(data.tokens ?? {})) this.tokens.set(k, v as IntroToken);
      for (const [k, v] of Object.entries(data.submissions ?? {})) this.submissions.set(k, v as IntroSubmission);
      log.info('Intro store loaded', { configs: this.configs.size, submissions: this.submissions.size });
    } catch (err) {
      log.warn('Failed to load intro store', { error: String(err) });
    }
  }
}
