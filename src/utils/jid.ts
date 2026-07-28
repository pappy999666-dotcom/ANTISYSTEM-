/**
 * WhatsApp JID (Jabber ID) utility functions.
 */

import {
  JID_SUFFIX_USER,
  JID_SUFFIX_GROUP,
  JID_SUFFIX_BROADCAST,
} from '../constants';

/** Extract the numeric phone portion from a JID */
export function jidToPhone(jid: string): string {
  return jid.split('@')[0].split(':')[0];
}

/** Convert a phone number to a user JID */
export function phoneToJid(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  return `${clean}${JID_SUFFIX_USER}`;
}

/** Check if a JID is a group */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith(JID_SUFFIX_GROUP);
}

/** Check if a JID is a user */
export function isUserJid(jid: string): boolean {
  return jid.endsWith(JID_SUFFIX_USER);
}

/** Check if a JID is a broadcast list */
export function isBroadcastJid(jid: string): boolean {
  return jid.endsWith(JID_SUFFIX_BROADCAST);
}

/** Normalize a JID by removing device suffixes (e.g. :5@s.whatsapp.net → @s.whatsapp.net) */
export function normalizeJid(jid: string): string {
  if (!jid) return jid;
  const [user, server] = jid.split('@');
  const baseUser = user.split(':')[0];
  return `${baseUser}@${server}`;
}

/** Compare two JIDs ignoring device identifiers */
export function jidEquals(a: string, b: string): boolean {
  return normalizeJid(a) === normalizeJid(b);
}
