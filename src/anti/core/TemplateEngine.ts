/**
 * PAPPYBOT V2 — Anti Template Engine
 *
 * Resolves variable-substitution templates for all anti action messages.
 * Unknown variables are silently ignored (not thrown).
 *
 * Supported variables:
 *   &mention   — @sender mention
 *   &gcname    — group name
 *   &sender    — sender phone/JID
 *   &count     — warn count
 *   &warn      — warn count (alias)
 *   &limit     — warn limit
 *   &time      — current time HH:MM:SS
 *   &date      — current date YYYY-MM-DD
 *   &reason    — action reason
 *   &detector  — detector ID that triggered
 *   &action    — action taken
 */

const DEFAULTS: Record<string, string> = {
  link:      '⚠️ @mention, links are not allowed in this group.',
  warn:      '⚠️ @mention has been warned (&count/&limit). Reason: &reason',
  kick:      '👢 @mention has been removed. Reason: &reason',
  spam:      '🚫 @mention, stop spamming! (&count messages)',
  bot:       '🤖 @mention appears to be a bot and has been removed.',
  picture:   '🖼️ @mention, images are not allowed in this group.',
  video:     '🎥 @mention, videos are not allowed in this group.',
  audio:     '🎵 @mention, audio files are not allowed in this group.',
  voice:     '🎙️ @mention, voice notes are not allowed in this group.',
  sticker:   '🎭 @mention, stickers are not allowed in this group.',
  text:      '💬 @mention, text messages are not allowed in this group.',
  emoji:     '😀 @mention, excessive emojis are not allowed in this group.',
  poll:      '📊 @mention, polls are not allowed in this group.',
  forward:   '↩️ @mention, forwarded messages are not allowed in this group.',
  channel:   '📢 @mention, channel messages are not allowed in this group.',
  words:     '🚫 @mention, your message contained a prohibited word.',
  nsfw:      '🔞 @mention, NSFW content is not allowed in this group.',
};

export class TemplateEngine {
  private readonly customTemplates = new Map<string, string>();

  /** Register or override a template by key */
  set(key: string, template: string): void {
    this.customTemplates.set(key, template);
  }

  /** Remove a custom template (falls back to default) */
  remove(key: string): void {
    this.customTemplates.delete(key);
  }

  /** Get the raw template string for a key */
  getTemplate(key: string): string {
    return this.customTemplates.get(key) ?? DEFAULTS[key] ?? '';
  }

  /**
   * Resolve a template with the given variables.
   * Unknown &variables are left as-is (safe).
   */
  resolve(key: string, vars: Record<string, string>): string {
    let tpl = this.getTemplate(key);
    if (!tpl) return '';

    for (const [varName, value] of Object.entries(vars)) {
      // Replace &varName and @varName patterns
      tpl = tpl.replaceAll(`&${varName}`, value);
      if (varName === 'mention') {
        tpl = tpl.replaceAll('@mention', value);
      }
    }

    // Inject time/date automatically
    const now = new Date();
    tpl = tpl.replaceAll('&time', now.toTimeString().slice(0, 8));
    tpl = tpl.replaceAll('&date', now.toISOString().slice(0, 10));

    return tpl;
  }

  /**
   * Build standard template vars from common anti context fields.
   */
  static buildVars(opts: {
    senderJid: string;
    groupName?: string;
    warnCount?: number;
    warnLimit?: number;
    reason?: string;
    detectorId?: string;
    action?: string;
    extra?: Record<string, string>;
  }): Record<string, string> {
    const phone = opts.senderJid.includes('@') ? opts.senderJid.split('@')[0]!.split(':')[0]! : opts.senderJid;
    return {
      mention: `@${phone}`,
      sender: phone,
      gcname: opts.groupName ?? 'this group',
      count: String(opts.warnCount ?? 0),
      warn: String(opts.warnCount ?? 0),
      limit: String(opts.warnLimit ?? 3),
      reason: opts.reason ?? 'violation',
      detector: opts.detectorId ?? '',
      action: opts.action ?? '',
      ...opts.extra,
    };
  }
}
