import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { GroupEngine } from '../engine/GroupEngine';
import { ROLES } from '../../types/Permissions';

export class KickCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'kick',
    description: 'Kick a participant from the group',
    usage: 'kick @mention | reply | phone',
    category: 'group',
    aliases: ['remove'],
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
      return this.replyError(ctx, 'I need to be an admin to kick members.');
    }

    const result = await this.groupEngine.participants.kick(message.sessionId, message.chatJid, target.jid);
    if (result.success) {
      await this.replySuccess(ctx, `@${target.jid.split('@')[0]} has been kicked.`);
    } else {
      await this.replyError(ctx, `Failed to kick: ${result.error}`);
    }
  }
}
