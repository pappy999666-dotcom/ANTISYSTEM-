/**
 * PAPPYBOT V2 — Group Management Listeners
 *
 * WelcomeListener    — fires on group:participant_added
 * GoodbyeListener    — fires on group:participant_removed
 * AdminProtectionListener — fires on group:participant_promoted / group:participant_demoted
 */

import { BaseListener } from '../../listeners/BaseListener';
import type { EventName, EventPayload } from '../../types/Events';
import type { GroupEngine } from '../engine/GroupEngine';

type GroupEventPayload = { sessionId: string; groupJid: string; jid: string };

// ── Welcome ──────────────────────────────────────────────────────────────────

export class WelcomeListener extends BaseListener {
  readonly name = 'WelcomeListener';
  readonly event: EventName = 'group:participant_added';

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async handle(payload: EventPayload<EventName>): Promise<void> {
    const { sessionId, groupJid, jid } = payload as GroupEventPayload;
    await this.groupEngine.welcome.sendWelcome(sessionId, groupJid, jid);
  }
}

// ── Goodbye ──────────────────────────────────────────────────────────────────

export class GoodbyeListener extends BaseListener {
  readonly name = 'GoodbyeListener';
  readonly event: EventName = 'group:participant_removed';

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async handle(payload: EventPayload<EventName>): Promise<void> {
    const { sessionId, groupJid, jid } = payload as GroupEventPayload;
    await this.groupEngine.welcome.sendGoodbye(sessionId, groupJid, jid);
  }
}

// ── Admin Protection ──────────────────────────────────────────────────────────

export class AdminProtectionDemoteListener extends BaseListener {
  readonly name = 'AdminProtectionDemoteListener';
  readonly event: EventName = 'group:participant_demoted';

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async handle(payload: EventPayload<EventName>): Promise<void> {
    const { sessionId, groupJid, jid } = payload as GroupEventPayload;
    await this.groupEngine.adminProtection.handleDemote(sessionId, groupJid, jid, jid);
  }
}

export class AdminProtectionPromoteListener extends BaseListener {
  readonly name = 'AdminProtectionPromoteListener';
  readonly event: EventName = 'group:participant_promoted';

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async handle(payload: EventPayload<EventName>): Promise<void> {
    const { sessionId, groupJid, jid } = payload as GroupEventPayload;
    await this.groupEngine.adminProtection.handlePromote(sessionId, groupJid, jid, jid);
  }
}
