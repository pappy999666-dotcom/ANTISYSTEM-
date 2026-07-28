/**
 * PAPPYBOT V2 — Welcome / Goodbye Engine
 *
 * Sends welcome messages when participants join and goodbye messages when they leave.
 * Uses GroupTemplateEngine for customizable templates.
 * Supports media attachments and the IntroCardService placeholder.
 *
 * Triggered by group-participants.update events via WelcomeListener.
 */

import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { EventBus } from '../../events/EventBus';
import type { GroupTemplateEngine } from './GroupTemplateEngine';
import type { IntroCardService } from '../services/IntroCardService';
import type { WelcomeConfig, GoodbyeConfig } from '../types/Group';
import { logger } from '../../logger/Logger';

const log = logger.child('WelcomeEngine');

export class WelcomeEngine {
  /** key: `${sessionId}:${groupJid}` */
  private readonly welcomeConfigs = new Map<string, WelcomeConfig>();
  private readonly goodbyeConfigs = new Map<string, GoodbyeConfig>();

  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache,
    private readonly bus: EventBus,
    private readonly templates: GroupTemplateEngine,
    private readonly introCards: IntroCardService
  ) {}

  private key(sessionId: string, groupJid: string): string {
    return `${sessionId}:${groupJid}`;
  }

  // ── Config ───────────────────────────────────────────────────────────────

  setWelcome(sessionId: string, groupJid: string, config: Partial<WelcomeConfig>): void {
    const k = this.key(sessionId, groupJid);
    const existing = this.welcomeConfigs.get(k) ?? { enabled: false, template: '' };
    this.welcomeConfigs.set(k, { ...existing, ...config });
  }

  setGoodbye(sessionId: string, groupJid: string, config: Partial<GoodbyeConfig>): void {
    const k = this.key(sessionId, groupJid);
    const existing = this.goodbyeConfigs.get(k) ?? { enabled: false, template: '' };
    this.goodbyeConfigs.set(k, { ...existing, ...config });
  }

  getWelcome(sessionId: string, groupJid: string): WelcomeConfig | undefined {
    return this.welcomeConfigs.get(this.key(sessionId, groupJid));
  }

  getGoodbye(sessionId: string, groupJid: string): GoodbyeConfig | undefined {
    return this.goodbyeConfigs.get(this.key(sessionId, groupJid));
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  async sendWelcome(sessionId: string, groupJid: string, newMemberJid: string): Promise<void> {
    const cfg = this.welcomeConfigs.get(this.key(sessionId, groupJid));
    if (!cfg?.enabled) return;

    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return;

    const meta = this.groupCache.get(groupJid);
    const vars = {
      mention: `@${newMemberJid.split('@')[0]}`,
      sender: newMemberJid.split('@')[0] ?? '',
      gcname: meta?.subject ?? 'this group',
      membercount: String(meta?.participants.length ?? 0),
      desc: meta?.description ?? '',
      reason: '',
    };

    const text = cfg.template
      ? this.resolveTemplate(cfg.template, vars)
      : this.templates.resolve(sessionId, groupJid, 'welcome', vars);

    try {
      const payload = this.buildPayload(text, [newMemberJid], cfg.mediaUrl, cfg.mediaType);

      // Attach intro card button if configured (placeholder)
      const introBtn = this.introCards.buildButtonPayload(sessionId, groupJid);
      if (introBtn) Object.assign(payload, introBtn);

      await sock.sendMessage(groupJid, payload);
      await this.bus.emit('group:welcome_sent', { sessionId, groupJid, memberJid: newMemberJid } as never);
      log.debug('Welcome sent', { groupJid, newMemberJid });
    } catch (err) {
      log.warn('Welcome send failed', { groupJid, error: String(err) });
    }
  }

  async sendGoodbye(sessionId: string, groupJid: string, leftMemberJid: string): Promise<void> {
    const cfg = this.goodbyeConfigs.get(this.key(sessionId, groupJid));
    if (!cfg?.enabled) return;

    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return;

    const meta = this.groupCache.get(groupJid);
    const vars = {
      mention: `@${leftMemberJid.split('@')[0]}`,
      sender: leftMemberJid.split('@')[0] ?? '',
      gcname: meta?.subject ?? 'this group',
      membercount: String(meta?.participants.length ?? 0),
      desc: meta?.description ?? '',
      reason: '',
    };

    const text = cfg.template
      ? this.resolveTemplate(cfg.template, vars)
      : this.templates.resolve(sessionId, groupJid, 'goodbye', vars);

    try {
      const payload = this.buildPayload(text, [leftMemberJid], cfg.mediaUrl, cfg.mediaType);
      await sock.sendMessage(groupJid, payload);
      await this.bus.emit('group:goodbye_sent', { sessionId, groupJid, memberJid: leftMemberJid } as never);
      log.debug('Goodbye sent', { groupJid, leftMemberJid });
    } catch (err) {
      log.warn('Goodbye send failed', { groupJid, error: String(err) });
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private resolveTemplate(template: string, vars: Record<string, string>): string {
    let t = template;
    for (const [k, v] of Object.entries(vars)) {
      t = t.replaceAll(`&${k}`, v).replaceAll(`@${k}`, v);
    }
    if (vars['mention']) t = t.replaceAll('@mention', vars['mention']);
    return t;
  }

  private buildPayload(
    text: string,
    mentions: string[],
    mediaUrl?: string,
    mediaType?: 'image' | 'video'
  ): Record<string, unknown> {
    if (mediaUrl && mediaType === 'image') {
      return { image: { url: mediaUrl }, caption: text, mentions };
    }
    if (mediaUrl && mediaType === 'video') {
      return { video: { url: mediaUrl }, caption: text, mentions };
    }
    return { text, mentions };
  }
}
