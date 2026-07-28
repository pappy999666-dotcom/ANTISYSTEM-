/**
 * PAPPYBOT V2 — Contact Type Definitions
 */

export interface CachedContact {
  jid: string;
  /** WhatsApp push name */
  pushName?: string;
  /** Display / verified name */
  displayName?: string;
  /** Whether this JID is a business account */
  isBusiness?: boolean;
  /** When this entry was last updated */
  cachedAt: number;
}

export interface ContactProfile {
  jid: string;
  pushName?: string;
  /** Profile status text */
  statusText?: string;
  /** Profile picture URL (temporary, may expire) */
  profilePictureUrl?: string;
}
