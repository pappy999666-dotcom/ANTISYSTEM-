/**
 * PAPPYBOT V2 — Anti Engine
 *
 * Central orchestrator for the entire Anti System.
 * Wires DetectorEngine, RuleEngine, ActionEngine, PermitEngine,
 * ConfigManager, AuditLogger, StatsManager, and TemplateEngine.
 *
 * Message inspection pipeline:
 *   Receive → Permission/Permit Check → DetectorEngine (parallel)
 *     → RuleEngine → ActionEngine → AuditLogger → EventBus
 *
 * One AntiEngine instance is shared across all sessions.
 * Per-group isolation is enforced through AntiConfigManager.
 *
 * Extension point: register new detectors via antiEngine.detectors.register().
 */

import { DetectorEngine } from './DetectorEngine';
import { RuleEngine } from './RuleEngine';
import { ActionEngine } from './ActionEngine';
import { PermitEngine } from './PermitEngine';
import { AntiConfigManager } from './ConfigManager';
import { AuditLogger } from './AuditLogger';
import { StatsManager } from './StatsManager';
import { TemplateEngine } from './TemplateEngine';
import { WarnService } from '../services/WarnService';
import { BanService } from '../services/BanService';

// Detectors
import { LinkDetector } from '../detectors/LinkDetector';
import { BotDetector } from '../detectors/BotDetector';
import { SpamDetector } from '../detectors/SpamDetector';
import {
  PictureDetector, VideoDetector, AudioDetector,
  VoiceDetector, StickerDetector, DocumentDetector,
} from '../detectors/MediaDetectors';
import {
  TextDetector, EmojiDetector, PollDetector,
  ForwardDetector, ChannelDetector, GroupCallDetector,
} from '../detectors/SimpleDetectors';
import { WordFilterDetector } from '../detectors/WordFilterDetector';
import { NsfwDetector } from '../detectors/NsfwDetector';

import type { ExtendedNormalizedMessage } from '../../whatsapp/MessageNormalizer';
import type { SocketManager } from '../../whatsapp/SocketManager';
import type { GroupCache } from '../../whatsapp/GroupCache';
import type { EventBus } from '../../events/EventBus';
import type { AntiContext } from '../types/Anti';
import { logger } from '../../logger/Logger';

const log = logger.child('AntiEngine');

export class AntiEngine {
  readonly detectors: DetectorEngine;
  readonly rules: RuleEngine;
  readonly actions: ActionEngine;
  readonly permits: PermitEngine;
  readonly config: AntiConfigManager;
  readonly audit: AuditLogger;
  readonly stats: StatsManager;
  readonly templates: TemplateEngine;
  readonly warns: WarnService;
  readonly bans: BanService;

  private readonly ownerJid: string;
  private readonly botJid: string;
  private readonly sudoJids: string[];

  constructor(
    private readonly socketManager: SocketManager,
    private readonly groupCache: GroupCache,
    private readonly bus: EventBus,
    opts: { ownerJid: string; botJid: string; sudoJids?: string[] }
  ) {
    this.ownerJid = opts.ownerJid;
    this.botJid = opts.botJid;
    this.sudoJids = opts.sudoJids ?? [];

    this.config = new AntiConfigManager();
    this.templates = new TemplateEngine();
    this.audit = new AuditLogger();
    this.stats = new StatsManager();
    this.permits = new PermitEngine();
    this.warns = new WarnService(this.config, bus);
    this.bans = new BanService(bus);
    this.detectors = new DetectorEngine();
    this.rules = new RuleEngine();
    this.actions = new ActionEngine(socketManager, this.warns, this.bans, bus, this.templates);

    this.registerAllDetectors();
    this.attachBusListeners();
  }

  // ── Pipeline ─────────────────────────────────────────────────────────────

  /**
   * Run the full anti inspection pipeline for an incoming message.
   * Called from the MessagePipeline middleware or directly from WhatsAppClient.
   */
  async inspect(message: ExtendedNormalizedMessage): Promise<void> {
    // Only process group messages
    if (message.chatType !== 'group') return;

    const { sessionId, chatJid: groupJid, sender } = message;
    const senderJid = sender.jid;

    // ── Ban check — delete messages from banned users immediately ──────────
    if (this.bans.isBanned(sessionId, groupJid, senderJid)) {
      await this.deleteMessage(sessionId, groupJid, message);
      return;
    }

    const groupConfig = this.config.get(sessionId, groupJid);

    // ── Run all enabled detectors in parallel ──────────────────────────────
    const results = await this.detectors.runAll(message, groupConfig);

    // ── Evaluate rules ─────────────────────────────────────────────────────
    const triggered = this.rules.evaluateAll(results, groupConfig);
    if (!triggered.length) return;

    for (const { result, rule } of triggered) {
      // ── Permit check ────────────────────────────────────────────────────
      const detectorCfg = groupConfig.detectors[result.detectorId];
      const adminBypass = (detectorCfg?.settings['adminBypass'] as boolean | undefined) ?? true;

      const permitted = this.permits.isPermitted({
        sessionId, groupJid, senderJid,
        detectorId: result.detectorId,
        ownerJid: this.ownerJid,
        botJid: this.botJid,
        sudoJids: this.sudoJids,
        groupCache: this.groupCache,
        adminBypass,
      });

      if (permitted) {
        this.stats.recordPermit(sessionId, groupJid);
        continue;
      }

      // ── Build context ────────────────────────────────────────────────────
      const warnCount = this.warns.getCount(sessionId, groupJid, senderJid);
      const warnLimit = this.config.getWarnLimit(sessionId, groupJid);
      const groupMeta = this.groupCache.get(groupJid);

      const templateVars = TemplateEngine.buildVars({
        senderJid,
        groupName: groupMeta?.subject,
        warnCount,
        warnLimit,
        reason: result.reason,
        detectorId: result.detectorId,
        action: rule.action,
      });

      const ctx: AntiContext = {
        sessionId, groupJid, senderJid,
        messageId: message.id,
        messageKey: (message.raw as Record<string, unknown>)?.['key'] as Record<string, unknown> ?? { id: message.id, remoteJid: groupJid },
        detectionResult: result,
        rule,
        groupConfig,
        templateVars,
      };

      // ── Execute action ───────────────────────────────────────────────────
      const actionResult = await this.actions.execute(ctx);

      // ── Audit + Stats ────────────────────────────────────────────────────
      this.audit.record({
        sessionId, groupJid, senderJid,
        detectorId: result.detectorId,
        action: rule.action,
        reason: result.reason ?? result.detectorId,
        executionMs: result.executionMs + actionResult.executionMs,
        metadata: result.metadata,
      });

      this.stats.recordDetection(sessionId, groupJid, result.detectorId);
      this.stats.recordAction(sessionId, groupJid, rule.action);

      log.debug('Anti triggered', {
        sessionId, groupJid, senderJid,
        detector: result.detectorId,
        action: rule.action,
        success: actionResult.success,
      });
    }
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async deleteMessage(
    sessionId: string,
    groupJid: string,
    message: ExtendedNormalizedMessage
  ): Promise<void> {
    const sock = this.socketManager.getSocket(sessionId);
    if (!sock) return;
    const key = (message.raw as Record<string, unknown>)?.['key'] as Record<string, unknown> | undefined;
    if (!key) return;
    try {
      await sock.sendMessage(groupJid, { delete: key });
    } catch { /* non-critical */ }
  }

  private registerAllDetectors(): void {
    this.detectors.register(new LinkDetector());
    this.detectors.register(new BotDetector());
    this.detectors.register(new SpamDetector());
    this.detectors.register(PictureDetector);
    this.detectors.register(VideoDetector);
    this.detectors.register(AudioDetector);
    this.detectors.register(VoiceDetector);
    this.detectors.register(StickerDetector);
    this.detectors.register(DocumentDetector);
    this.detectors.register(TextDetector);
    this.detectors.register(EmojiDetector);
    this.detectors.register(PollDetector);
    this.detectors.register(ForwardDetector);
    this.detectors.register(ChannelDetector);
    this.detectors.register(GroupCallDetector);
    this.detectors.register(new WordFilterDetector());
    this.detectors.register(new NsfwDetector());
    log.info('All detectors registered', { count: this.detectors.getIds().length });
  }

  private attachBusListeners(): void {
    // Route call:incoming events through the GroupCall detector pipeline
    this.bus.on('call:incoming', async ({ sessionId, callId, callerJid }) => {
      // Build a synthetic normalized message for the call event
      const synthetic = {
        id: callId,
        sessionId,
        chatJid: callerJid,
        chatType: 'group' as const,
        sender: { jid: callerJid, phone: callerJid.split('@')[0] ?? '', isBot: false },
        type: 'call' as never,
        mentions: [],
        timestamp: Math.floor(Date.now() / 1000),
        isOwner: false,
        isCommand: false,
        raw: {},
      };
      await this.inspect(synthetic as unknown as ExtendedNormalizedMessage);
    });
  }
}
