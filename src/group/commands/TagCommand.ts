import { BaseCommand } from '../../commands/BaseCommand';
import type { CommandMeta, CommandContext } from '../../types/Command';
import type { GroupEngine } from '../engine/GroupEngine';
import { ROLES } from '../../types/Permissions';
import { R } from '../../ui/ResponseFormatter';

export class TagCommand extends BaseCommand {
  readonly meta: CommandMeta = {
    name: 'tag',
    description: 'Tag all group members with an optional message',
    usage: 'tag [message]',
    category: 'group',
    aliases: ['tagall', 'everyone'],
    requiredRole: ROLES.ADMIN,
    groupOnly: true,
  };

  constructor(private readonly groupEngine: GroupEngine) { super(); }

  async execute(ctx: CommandContext): Promise<void> {
    const { message, args } = ctx;

    const quoted = message.quotedMessage;
    const mediaBuffer = quoted?.mediaBuffer as Buffer | undefined;
    const mediaType = quoted?.type as 'image' | 'video' | 'audio' | 'voice' | 'sticker' | 'document' | undefined;

    const meta = await this.groupEngine.getMetadata(message.sessionId, message.chatJid, false).catch(() => null);
    const memberCount = meta?.participants.length ?? 0;

    await this.groupEngine.tag.tagAll(message.sessionId, message.chatJid, {
      message: args.raw || undefined,
      mediaBuffer,
      mediaType,
      mimeType: quoted?.mimeType as string | undefined,
      fileName: quoted?.fileName as string | undefined,
    });

    await ctx.reply(R.tag(memberCount, args.raw || undefined));
  }
}
