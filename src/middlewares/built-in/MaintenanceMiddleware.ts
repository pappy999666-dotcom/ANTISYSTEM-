/**
 * Built-in maintenance mode middleware.
 * When enabled, blocks all non-owner commands.
 */

import { BaseMiddleware, type MiddlewareContext, type MiddlewareNext } from '../BaseMiddleware';
import { ROLES } from '../../types/Permissions';
import type { PermissionManager } from '../../permissions/PermissionManager';

export class MaintenanceMiddleware extends BaseMiddleware {
  readonly name = 'Maintenance';
  readonly priority = 900;

  private maintenanceMode = false;
  private readonly permissions: PermissionManager;

  constructor(permissions: PermissionManager) {
    super();
    this.permissions = permissions;
  }

  setMaintenanceMode(enabled: boolean): void {
    this.maintenanceMode = enabled;
    this.log.info('Maintenance mode changed', { enabled });
  }

  isInMaintenance(): boolean {
    return this.maintenanceMode;
  }

  async execute(ctx: MiddlewareContext, next: MiddlewareNext): Promise<void> {
    if (!this.maintenanceMode) {
      await next();
      return;
    }

    // Allow global owners through even during maintenance
    const isOwner = await this.permissions.hasRole(
      ctx.message.sender.jid,
      ROLES.GLOBAL_OWNER,
      ctx.session.config.id
    );

    if (isOwner) {
      await next();
      return;
    }

    this.log.debug('Request blocked by maintenance mode', {
      sender: ctx.message.sender.jid,
    });
    // Short-circuit: maintenance mode active, not owner
  }
}
