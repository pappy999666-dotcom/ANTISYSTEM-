/**
 * Normalized message types that abstract away Baileys internals.
 * All internal message processing uses NormalizedMessage, never raw Baileys objects.
 */

export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'voice'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contact'
  | 'reaction'
  | 'poll'
  | 'unknown';

export type ChatType = 'private' | 'group';

export interface MessageSender {
  jid: string;
  /** Formatted phone number without suffixes */
  phone: string;
  /** Name from WhatsApp profile or group participant info */
  displayName?: string;
  isBot: boolean;
}

export interface MessageQuoted {
  id: string;
  senderJid: string;
  text?: string;
  type: MessageType;
}

export interface NormalizedMessage {
  /** Unique message ID from WhatsApp */
  id: string;
  /** Session this message belongs to */
  sessionId: string;
  /** Chat JID (group or individual) */
  chatJid: string;
  chatType: ChatType;
  sender: MessageSender;
  type: MessageType;
  /** Extracted plain text (for text/caption) */
  text?: string;
  /** Quoted/replied-to message if present */
  quoted?: MessageQuoted;
  /**
   * Extended quoted message with media — populated by MessageNormalizer
   * when the quoted message contains downloadable media.
   */
  quotedMessage?: {
    sender?: { jid: string };
    type?: MessageType;
    mediaBuffer?: Buffer;
    mimeType?: string;
    fileName?: string;
    [key: string]: unknown;
  };
  /** Downloaded media buffer for the current message (if applicable) */
  mediaBuffer?: Buffer;
  /** Mentioned JIDs in the message */
  mentions: string[];
  /** Unix timestamp */
  timestamp: number;
  /** Whether this message is from the session owner */
  isOwner: boolean;
  /** Whether the message triggered a command */
  isCommand: boolean;
  /** Raw Baileys message object — use only in edge cases */
  raw: unknown;
}

export interface OutgoingMessage {
  chatJid: string;
  sessionId: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';
  text?: string;
  caption?: string;
  media?: Buffer | string;
  mimeType?: string;
  fileName?: string;
  /** JID to mention */
  mentions?: string[];
  /** Message to quote/reply to */
  quotedMessageId?: string;
  /** View once flag */
  viewOnce?: boolean;
}
