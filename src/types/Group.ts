/**
 * PAPPYBOT V2 — Group Type Definitions
 */

export interface GroupParticipant {
  jid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

export interface GroupMetadata {
  /** Group JID */
  id: string;
  /** Group subject / name */
  subject: string;
  /** Group description */
  description?: string;
  /** Owner JID */
  owner?: string;
  /** Invite link (if fetched) */
  inviteCode?: string;
  /** All participants */
  participants: GroupParticipant[];
  /** Announce mode — only admins can send */
  announce?: boolean;
  /** Restrict — only admins can edit group info */
  restrict?: boolean;
  /** Join approval required */
  joinApprovalMode?: boolean;
  /** Disappearing message duration (seconds), 0 = off */
  ephemeralDuration?: number;
  /** When metadata was last fetched */
  cachedAt: number;
}

export interface GroupCreateOptions {
  subject: string;
  participants: string[];
}

export interface ParticipantUpdateAction {
  action: 'add' | 'remove' | 'promote' | 'demote';
  participants: string[];
}
