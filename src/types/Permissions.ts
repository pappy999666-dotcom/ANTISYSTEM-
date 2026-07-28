/**
 * RBAC permission system types.
 */

/** Built-in role hierarchy (higher index = more privileged) */
export const ROLES = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUDO: 'SUDO',
  SESSION_OWNER: 'SESSION_OWNER',
  GLOBAL_OWNER: 'GLOBAL_OWNER',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Role inheritance chain — each role inherits all roles below it */
export const ROLE_HIERARCHY: Role[] = [
  ROLES.USER,
  ROLES.ADMIN,
  ROLES.SUDO,
  ROLES.SESSION_OWNER,
  ROLES.GLOBAL_OWNER,
];

export interface PermissionContext {
  senderJid: string;
  sessionId: string;
  chatJid: string;
  isGroup: boolean;
}
