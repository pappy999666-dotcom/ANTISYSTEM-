/**
 * PAPPYBOT V2 — Application-wide constants.
 */

export const APP_NAME = 'PAPPYBOT V2';
export const APP_VERSION = '2.0.0';

/** Default command prefix */
export const DEFAULT_PREFIX = '!';

/** Default command cooldown in milliseconds */
export const DEFAULT_COOLDOWN_MS = 3_000;

/** Maximum raw message text length accepted */
export const MAX_INPUT_LENGTH = 4_096;

/** WhatsApp JID suffixes */
export const JID_SUFFIX_USER = '@s.whatsapp.net';
export const JID_SUFFIX_GROUP = '@g.us';
export const JID_SUFFIX_BROADCAST = '@broadcast';

/** Cache TTL defaults (seconds) */
export const CACHE_TTL_SHORT = 60;
export const CACHE_TTL_DEFAULT = 300;
export const CACHE_TTL_LONG = 3_600;
export const CACHE_TTL_FOREVER = null;

/** Session reconnect settings */
export const SESSION_RECONNECT_DELAY_MS = 5_000;
export const SESSION_MAX_RECONNECT_ATTEMPTS = 10;
export const SESSION_QR_TIMEOUT_MS = 60_000;

/** Scheduler timezone default */
export const DEFAULT_TIMEZONE = 'UTC';

/** Log directory */
export const LOG_DIR = 'logs';

/** Storage paths */
export const SESSIONS_PATH = 'storage/sessions';
export const MEDIA_PATH = 'storage/media';
