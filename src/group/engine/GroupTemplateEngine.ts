/**
 * PAPPYBOT V2 — Group Template Engine
 *
 * Per-group, per-session template store for all group management messages.
 * Extends the Anti TemplateEngine concept for group-specific templates.
 *
 * Supported variables:
 *   @mention   — @phone mention
 *   &gcname    — group name
 *   &membercount — current participant count
 *   &date      — current date YYYY-MM-DD
 *   &time      — current time HH:MM:SS
 *   &desc      — group description
 *   &sender    — sender phone
 *   &reason    — action reason
 */

const DEFAULTS: Record<string, string> = {
  welcome:     '👋 Welcome @mention to *&gcname*!\nWe now have &membercount members.',
  goodbye:     '👋 @mention has left *&gcname*. We now have &membercount members.',
  kick:        '👢 @mention has been removed from *&gcname*.',
  warn:        '⚠️ @mention has been warned. Reason: &reason',
  promote:     '⬆️ @mention has been promoted to admin in *&gcname*.',
  demote:      '⬇️ @mention has been demoted in *&gcname*.',
  antidemote:  '🛡️ @mention tried to demote an admin. Action taken.',
  antipromote: '🛡️ @mention tried to promote a non-admin. Action taken.',
  antilink:    '🔗 @mention, links are not allowed in *&gcname*.',
};

export class GroupTemplateEngine {
  /** key: `${sessionId}:${groupJid}` → templates */
  private readonly store = new Map<string, Record<string, string>>();

  private key(sessionId: string, groupJid: string): string {
    return `${sessionId}:${groupJid}`;
  }

  set(sessionId: string, groupJid: string, templateKey: string, value: string): void {
    const k = this.key(sessionId, groupJid);
    let t = this.store.get(k);
    if (!t) { t = {}; this.store.set(k, t); }
    t[templateKey] = value;
  }

  get(sessionId: string, groupJid: string, templateKey: string): string {
    return this.store.get(this.key(sessionId, groupJid))?.[templateKey]
      ?? DEFAULTS[templateKey]
      ?? '';
  }

  remove(sessionId: string, groupJid: string, templateKey: string): void {
    const t = this.store.get(this.key(sessionId, groupJid));
    if (t) delete t[templateKey];
  }

  resolve(
    sessionId: string,
    groupJid: string,
    templateKey: string,
    vars: Record<string, string>
  ): string {
    let tpl = this.get(sessionId, groupJid, templateKey);
    if (!tpl) return '';

    for (const [k, v] of Object.entries(vars)) {
      tpl = tpl.replaceAll(`&${k}`, v).replaceAll(`@${k}`, v);
    }
    if (vars['mention']) tpl = tpl.replaceAll('@mention', vars['mention']);

    const now = new Date();
    tpl = tpl.replaceAll('&date', now.toISOString().slice(0, 10));
    tpl = tpl.replaceAll('&time', now.toTimeString().slice(0, 8));

    return tpl;
  }

  static buildVars(opts: {
    senderJid: string;
    groupName?: string;
    memberCount?: number;
    description?: string;
    reason?: string;
    extra?: Record<string, string>;
  }): Record<string, string> {
    const phone = opts.senderJid.split('@')[0] ?? opts.senderJid;
    return {
      mention: `@${phone}`,
      sender: phone,
      gcname: opts.groupName ?? 'this group',
      membercount: String(opts.memberCount ?? 0),
      desc: opts.description ?? '',
      reason: opts.reason ?? '',
      ...opts.extra,
    };
  }
}
