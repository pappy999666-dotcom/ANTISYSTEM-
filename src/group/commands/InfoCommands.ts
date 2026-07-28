import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { GroupEngine } from '../engine/GroupEngine';
import { ROLES } from '../../types/Permissions';
import { R } from '../../ui/ResponseFormatter';
import { resolveTarget } from '../../utils/TargetResolver';
import { normalizeJid } from '../../utils/jid';

export class GetGroupInfoCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'groupinfo',
    description: 'Show current group information',
    category: 'group',
    aliases: ['ginfo', 'gcinfo'],
    requiredRole: ROLES.USER,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message } = ctx;
    const meta = await this.groupEngine.getMetadata(message.sessionId, message.chatJid, true);
    if (!meta) return this.replyError(ctx, 'Could not fetch group info.');

    const admins = meta.participants.filter(p => p.isAdmin).map(p => `+${p.jid.split('@')[0]}`).join(', ');
    const body = [
      `Name: *${meta.subject}*`,
      `Members: *${meta.participants.length}*`,
      `Admins: *${admins || 'none'}*`,
      meta.description ? `Desc: ${meta.description.slice(0, 80)}` : null,
      `Announce: *${meta.announce ? 'on' : 'off'}*`,
      `Restrict: *${meta.restrict ? 'on' : 'off'}*`,
    ].filter(Boolean).join('\n');

    await ctx.reply(R.info(body, 'GROUP INFO'));
  }
}

export class GetInfoCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'info',
    description: 'Get profile info for a user',
    usage: 'info @mention | reply | phone',
    category: 'group',
    requiredRole: ROLES.USER,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const target = resolveTarget(
      message.mentions ?? [],
      message.quotedMessage?.sender?.jid,
      args.argv[0]
    );

    const jid = target?.jid ?? normalizeJid((message.sender?.jid as string) ?? '');
    const loadId = await this.replyLoading(ctx, 'Fetching profile...');

    const [pfp, status] = await Promise.all([
      this.groupEngine.fetchProfilePicture(message.sessionId, jid).catch(() => null),
      this.groupEngine.fetchStatus(message.sessionId, jid).catch(() => null),
    ]);

    const body = [
      `JID:   \`${jid}\``,
      `Phone: *+${jid.split('@')[0]}*`,
      status ? `Status: ${status}` : null,
      pfp ? `Picture: ${pfp}` : null,
    ].filter(Boolean).join('\n');

    await this.editOrReply(ctx, loadId, R.info(body, 'USER INFO'));
  }
}
