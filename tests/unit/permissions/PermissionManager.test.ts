import { PermissionManager } from '../../../src/permissions/PermissionManager';
import { CacheManager } from '../../../src/cache/CacheManager';
import { ROLES } from '../../../src/types/Permissions';

function makePerms(owner?: string) {
  const cache = new CacheManager(undefined, 300, 9999);
  return new PermissionManager(cache, owner);
}

describe('PermissionManager', () => {
  it('global owner always has GLOBAL_OWNER role', async () => {
    const perms = makePerms('owner@s.whatsapp.net');
    expect(await perms.hasRole('owner@s.whatsapp.net', ROLES.GLOBAL_OWNER, 'sess1')).toBe(true);
  });

  it('regular user defaults to USER role', async () => {
    const perms = makePerms();
    expect(await perms.hasRole('user@s.whatsapp.net', ROLES.USER, 'sess1')).toBe(true);
  });

  it('regular user does not have SUDO role', async () => {
    const perms = makePerms();
    expect(await perms.hasRole('user@s.whatsapp.net', ROLES.SUDO, 'sess1')).toBe(false);
  });

  it('assign() grants a role', async () => {
    const perms = makePerms();
    perms.assign('sudo@s.whatsapp.net', ROLES.SUDO, 'sess1');
    expect(await perms.hasRole('sudo@s.whatsapp.net', ROLES.SUDO, 'sess1')).toBe(true);
  });

  it('revoke() removes a role', async () => {
    const perms = makePerms();
    perms.assign('sudo@s.whatsapp.net', ROLES.SUDO, 'sess1');
    perms.revoke('sudo@s.whatsapp.net', 'sess1');
    expect(await perms.hasRole('sudo@s.whatsapp.net', ROLES.SUDO, 'sess1')).toBe(false);
  });

  it('global assignment applies across sessions', async () => {
    const perms = makePerms();
    perms.assign('global@s.whatsapp.net', ROLES.SUDO, '*');
    expect(await perms.hasRole('global@s.whatsapp.net', ROLES.SUDO, 'sess1')).toBe(true);
    expect(await perms.hasRole('global@s.whatsapp.net', ROLES.SUDO, 'sess2')).toBe(true);
  });

  it('GLOBAL_OWNER satisfies all lower role checks', async () => {
    const perms = makePerms('owner@s.whatsapp.net');
    for (const role of Object.values(ROLES)) {
      expect(await perms.hasRole('owner@s.whatsapp.net', role, 'sess1')).toBe(true);
    }
  });

  it('listAssignments returns session roles', () => {
    const perms = makePerms('owner@s.whatsapp.net');
    perms.assign('a@s.whatsapp.net', ROLES.ADMIN, 'sess1');
    const list = perms.listAssignments('sess1');
    expect(list.some(r => r.jid === 'a@s.whatsapp.net')).toBe(true);
  });
});
