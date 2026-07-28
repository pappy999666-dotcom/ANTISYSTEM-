import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { GroupEngine } from '../engine/GroupEngine';
import { ROLES } from '../../types/Permissions';

export class PromoteCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'promote',
    description: 'Promote a participant to admin',
    usage: 'promote @mention | reply | phone',
    category: 'group',
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const target = this.groupEngine.participants.resolveTarget(
      message.mentions ?? [],
      message.quotedMessage?.sender?.jid,
      args.argv[0]
    );
    if (!target) return this.replyError(ctx, 'Specify a target via mention, reply, or phone number.');

    if (!this.groupEngine.participants.isBotAdmin(message.sessionId, message.chatJid)) {
      return this.replyError(ctx, 'I need to be an admin to promote members.');
    }

    const result = await this.groupEngine.participants.promote(message.sessionId, message.chatJid, target.jid);
    if (result.success) {
      await this.replySuccess(ctx, `@${target.jid.split('@')[0]} has been promoted to admin.`);
    } else {
      await this.replyError(ctx, `Failed to promote: ${result.error}`);
    }
  }
}

export class DemoteCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'demote',
    description: 'Demote an admin to regular member',
    usage: 'demote @mention | reply | phone',
    category: 'group',
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const target = this.groupEngine.participants.resolveTarget(
      message.mentions ?? [],
      message.quotedMessage?.sender?.jid,
      args.argv[0]
    );
    if (!target) return this.replyError(ctx, 'Specify a target via mention, reply, or phone number.');

    if (!this.groupEngine.participants.isBotAdmin(message.sessionId, message.chatJid)) {
      return this.replyError(ctx, 'I need to be an admin to demote members.');
    }

    const result = await this.groupEngine.participants.demote(message.sessionId, message.chatJid, target.jid);
    if (result.success) {
      await this.replySuccess(ctx, `@${target.jid.split('@')[0]} has been demoted.`);
    } else {
      await this.replyError(ctx, `Failed to demote: ${result.error}`);
    }
  }
}
