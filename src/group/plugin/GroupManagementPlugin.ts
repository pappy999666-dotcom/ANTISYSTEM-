import { BasePlugin } from '../../plugins/BasePlugin';
import type { PluginContext } from '../../plugins/BasePlugin';
import type { PluginMeta } from '../../types/Plugin';
import { GroupEngine } from '../engine/GroupEngine';
import { KickCommand } from '../commands/KickCommand';
import { PromoteCommand, DemoteCommand } from '../commands/PromoteDemoteCommands';
import { TagCommand } from '../commands/TagCommand';
import { GetGroupInfoCommand, GetInfoCommand } from '../commands/InfoCommands';
import {
  SetGroupNameCommand,
  SetDescriptionCommand,
  GroupLinkCommand,
  LeaveGroupCommand,
  SetGroupPictureCommand,
  SetProfilePictureCommand,
  CreateGroupCommand,
} from '../commands/GroupSettingsCommands';
import {
  WelcomeListener,
  GoodbyeListener,
  AdminProtectionDemoteListener,
  AdminProtectionPromoteListener,
} from '../listeners/GroupListeners';
import { socketManager } from '../../whatsapp/SocketManager';
import { GroupCache } from '../../whatsapp/GroupCache';
import { ContactCache } from '../../whatsapp/ContactCache';

export class GroupManagementPlugin extends BasePlugin {
  readonly meta: PluginMeta = {
    id: 'group-management',
    name: 'Group Management',
    version: '1.0.0',
    description: 'Full group management: kick, promote, demote, tag, welcome, admin protection, and more.',
  };

  private groupEngine!: GroupEngine;

  async load(ctx: PluginContext): Promise<void> {
    const groupCache = new GroupCache();
    const contactCache = new ContactCache();

    this.groupEngine = new GroupEngine(socketManager, groupCache, contactCache, ctx.bus);

    // Commands
    ctx.commands.registerAll([
      new KickCommand(this.groupEngine),
      new PromoteCommand(this.groupEngine),
      new DemoteCommand(this.groupEngine),
      new TagCommand(this.groupEngine),
      new GetGroupInfoCommand(this.groupEngine),
      new GetInfoCommand(this.groupEngine),
      new SetGroupNameCommand(this.groupEngine),
      new SetDescriptionCommand(this.groupEngine),
      new GroupLinkCommand(this.groupEngine),
      new LeaveGroupCommand(this.groupEngine),
      new SetGroupPictureCommand(this.groupEngine),
      new SetProfilePictureCommand(this.groupEngine),
      new CreateGroupCommand(this.groupEngine),
    ]);

    // Listeners
    const listeners = [
      new WelcomeListener(this.groupEngine),
      new GoodbyeListener(this.groupEngine),
      new AdminProtectionDemoteListener(this.groupEngine),
      new AdminProtectionPromoteListener(this.groupEngine),
    ];
    for (const l of listeners) ctx.listeners.register(l);

    this.log.info('Group Management plugin loaded');
  }
}
