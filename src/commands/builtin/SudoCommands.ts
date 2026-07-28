/**
 * PAPPYBOT V2 — Sudo Management Commands
 *
 * .setsudo — grant SUDO role (reply | @mention | phone | JID)
 * .delsudo — revoke SUDO role
 */

import { BaseCommand } from '../BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { PermissionManager } from '../../permissions/PermissionManager';
import { ROLES } from '../../types/Permissions';
import { R } from '../../ui/ResponseFormatter';
import { resolveTarget, toUserJid } from '../../utils/TargetResolver';

export class SetSudoCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setsudo',
    description: 'Grant sudo role to a user',
    usage: 'setsudo @mention | reply | phone | JID',
    category: 'owner',
    aliases: ['addsudo'],
    requiredRole: ROLES.SESSION_OWNER,
  };

  constructor(private readonly permissions: PermissionManager) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const target = resolveTarget(
      ctx.message.mentions ?? [],
      ctx.message.quotedMessage?.sender?.jid,
      ctx.args.argv[0]
    );

    if (!target) {
      return this.replyError(ctx, 'Specify a target via @mention, reply, phone number, or JID.');
    }

    this.permissions.assign(target.jid, ROLES.SUDO, ctx.session.config.id);
    await ctx.reply(R.sudo(
      `Granted *SUDO* to:\n+${target.phone}` +
      (target.displayName ? ` (${target.displayName})` : '')
    ));
  }
}

export class DelSudoCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'delsudo',
    description: 'Revoke sudo role from a user',
    usage: 'delsudo @mention | reply | phone | JID',
    category: 'owner',
    aliases: ['removesudo', 'unsudo'],
    requiredRole: ROLES.SESSION_OWNER,
  };

  constructor(private readonly permissions: PermissionManager) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const target = resolveTarget(
      ctx.message.mentions ?? [],
      ctx.message.quotedMessage?.sender?.jid,
      ctx.args.argv[0]
    );

    if (!target) {
      return this.replyError(ctx, 'Specify a target via @mention, reply, phone number, or JID.');
    }

    this.permissions.revoke(target.jid, ctx.session.config.id);
    await ctx.reply(R.sudo(`Revoked *SUDO* from:\n+${target.phone}`));
  }
}
