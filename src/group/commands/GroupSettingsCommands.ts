import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { GroupEngine } from '../engine/GroupEngine';
import { ROLES } from '../../types/Permissions';
import { R } from '../../ui/ResponseFormatter';

// ── Set Group Name ─────────────────────────────────────────────────────────────

export class SetGroupNameCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setname',
    description: 'Change the group name',
    usage: 'setname <new name>',
    category: 'group',
    aliases: ['groupname', 'gcname'],
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1, 'setname <new name>')) return;
    const name = ctx.args.raw.trim();
    const loadId = await this.replyLoading(ctx, 'Updating group name...');
    try {
      await this.groupEngine.setSubject(ctx.message.sessionId, ctx.message.chatJid, name);
      await this.editOrReply(ctx, loadId, R.group(`Group name changed to: *${name}*`));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}

// ── Set Description ────────────────────────────────────────────────────────────

export class SetDescriptionCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setdesc',
    description: 'Change the group description',
    usage: 'setdesc <description>',
    category: 'group',
    aliases: ['desc', 'setdescription'],
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    if (!this.requireArgs(ctx, 1, 'setdesc <description>')) return;
    const loadId = await this.replyLoading(ctx, 'Updating description...');
    try {
      await this.groupEngine.setDescription(ctx.message.sessionId, ctx.message.chatJid, ctx.args.raw.trim());
      await this.editOrReply(ctx, loadId, R.group('Group description updated.'));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}

// ── Group Link ─────────────────────────────────────────────────────────────────

export class GroupLinkCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'link',
    description: 'Get or revoke the group invite link',
    usage: 'link [revoke]',
    category: 'group',
    aliases: ['invite', 'invitelink'],
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const revoke = args.argv[0]?.toLowerCase() === 'revoke';
    const loadId = await this.replyLoading(ctx, revoke ? 'Revoking link...' : 'Fetching link...');
    try {
      const link = revoke
        ? await this.groupEngine.revokeInviteLink(message.sessionId, message.chatJid)
        : await this.groupEngine.getInviteLink(message.sessionId, message.chatJid);
      await this.editOrReply(ctx, loadId, R.link(link, revoke));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}

// ── Leave Group ────────────────────────────────────────────────────────────────

export class LeaveGroupCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'leave',
    description: 'Make the bot leave the current group',
    usage: 'leave',
    category: 'group',
    aliases: ['leavegroup'],
    requiredRole: ROLES.SESSION_OWNER,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    await ctx.reply(R.group('Leaving group...', 'DEPARTING'));
    await this.groupEngine.leaveGroup(ctx.message.sessionId, ctx.message.chatJid);
  }
}

// ── Set Group Picture ──────────────────────────────────────────────────────────

export class SetGroupPictureCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setgpic',
    description: 'Set the group profile picture (reply to an image)',
    usage: 'setgpic (reply to image)',
    category: 'group',
    aliases: ['setgrouppic', 'grouppic'],
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const buf = ctx.message.quotedMessage?.mediaBuffer as Buffer | undefined
      ?? ctx.message.mediaBuffer as Buffer | undefined;
    if (!buf) return this.replyError(ctx, 'Reply to an image to set the group picture.');
    const loadId = await this.replyLoading(ctx, 'Uploading group picture...');
    try {
      await this.groupEngine.setGroupPicture(ctx.message.sessionId, ctx.message.chatJid, buf);
      await this.editOrReply(ctx, loadId, R.group('Group picture updated.'));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}

// ── Set Profile Picture ────────────────────────────────────────────────────────

export class SetProfilePictureCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'setpic',
    description: "Set the bot's profile picture (reply to an image)",
    usage: 'setpic (reply to image)',
    category: 'owner',
    aliases: ['setprofilepic', 'botpic'],
    requiredRole: ROLES.SESSION_OWNER,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const buf = ctx.message.quotedMessage?.mediaBuffer as Buffer | undefined
      ?? ctx.message.mediaBuffer as Buffer | undefined;
    if (!buf) return this.replyError(ctx, 'Reply to an image to set the profile picture.');
    const loadId = await this.replyLoading(ctx, 'Uploading profile picture...');
    try {
      await this.groupEngine.setProfilePicture(ctx.message.sessionId, buf);
      await this.editOrReply(ctx, loadId, R.success('Profile picture updated.'));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}

// ── Create Group ───────────────────────────────────────────────────────────────

export class CreateGroupCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'creategroup',
    description: 'Create a new group with mentioned participants',
    usage: 'creategroup <name> @mentions...',
    category: 'owner',
    aliases: ['newgroup', 'mkgroup'],
    requiredRole: ROLES.SESSION_OWNER,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;
    const name = args.tokens[0];
    if (!name) return this.replyError(ctx, 'Usage: creategroup <name> @mentions...');

    const participants = message.mentions ?? [];
    if (!participants.length) return this.replyError(ctx, 'Mention at least one participant.');

    const steps = [
      { label: 'Creating group...', done: false },
      { label: 'Adding participants...', done: false },
      { label: 'Generating invite link...', done: false },
    ];

    const loadId = await ctx.replyGetId?.(R.progress(steps));

    try {
      steps[0]!.done = true;
      await ctx.editMessage?.(loadId ?? '', R.progress(steps));

      const { groupJid, inviteLink } = await this.groupEngine.createGroup(
        message.sessionId, name, participants,
        { creatorJid: message.sender?.jid as string | undefined }
      );

      steps[1]!.done = true;
      steps[2]!.done = true;
      await ctx.editMessage?.(loadId ?? '', R.progress(steps));

      await this.editOrReply(ctx, loadId, R.create(name, groupJid, inviteLink));
    } catch (err) {
      await this.editOrReply(ctx, loadId, R.error(String(err)));
    }
  }
}
