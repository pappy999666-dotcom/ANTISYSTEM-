/**
 * PAPPYBOT V2 — Response Formatter
 *
 * Centralized gothic/cyber design system for all bot responses.
 * Every command uses these builders — no hardcoded formatting anywhere else.
 *
 * Structure:
 *   Header (brand + type icon)
 *   ✠════[divider]════✠
 *   Body
 *   ◈ STATUS
 *   ✠════[divider]════✠
 */

// ── Brand constants ────────────────────────────────────────────────────────────

const BRAND   = '𝐏𝐀𝐏𝐏𝐘𝐁𝐎𝐓';
const CORE    = 'Omega Core';
const CROWN   = '⸸';
const SIGIL   = '❖⟬☩⟭❖';
const DIV_A   = '✠════☠════✠';
const DIV_B   = '✠════☩════✠';
const BULLET  = '◈';

// ── Type icons ─────────────────────────────────────────────────────────────────

const ICONS = {
  success:    '✅',
  error:      '☠',
  warning:    '⚠️',
  loading:    '⏳',
  progress:   '⚙️',
  info:       '📡',
  owner:      '👑',
  security:   '🔐',
  ai:         '🤖',
  menu:       '📋',
  kick:       '🦶',
  ban:        '🚫',
  permission: '🔒',
  ping:       '⚡',
  system:     '🖥',
  group:      '👥',
  warn:       '⚠️',
  promote:    '⬆️',
  demote:     '⬇️',
  tag:        '📢',
  link:       '🔗',
  leave:      '🚪',
  create:     '✨',
  status:     '📊',
  sudo:       '🛡',
} as const;

export type ResponseType = keyof typeof ICONS;

// ── Status labels ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ResponseType, string> = {
  success:    'EXECUTED',
  error:      'FAILED',
  warning:    'CAUTION',
  loading:    'PROCESSING',
  progress:   'IN PROGRESS',
  info:       'INFORMATION',
  owner:      'OWNER COMMAND',
  security:   'SECURITY',
  ai:         'AI RESPONSE',
  menu:       'MENU',
  kick:       'MEMBER REMOVED',
  ban:        'MEMBER BANNED',
  permission: 'ACCESS DENIED',
  ping:       'LATENCY CHECK',
  system:     'SYSTEM',
  group:      'GROUP ACTION',
  warn:       'WARNING ISSUED',
  promote:    'PROMOTED',
  demote:     'DEMOTED',
  tag:        'TAG BROADCAST',
  link:       'INVITE LINK',
  leave:      'DEPARTED',
  create:     'CREATED',
  status:     'STATUS',
  sudo:       'SUDO',
};

// ── Core builder ───────────────────────────────────────────────────────────────

export interface FormatOptions {
  type: ResponseType;
  body: string;
  /** Override the auto status label */
  status?: string;
  /** Extra footer line (optional) */
  footer?: string;
}

export function format(opts: FormatOptions): string {
  const icon   = ICONS[opts.type];
  const status = opts.status ?? STATUS_LABELS[opts.type];

  const lines: string[] = [
    `          ${CROWN}`,
    `     ${SIGIL}`,
    `     ${BRAND}   ${CORE}`,
    `     ${icon}  ${opts.type.toUpperCase()}`,
    `${DIV_A}`,
    ``,
    opts.body,
    ``,
    `${BULLET} ${status}`,
    `${DIV_B}`,
  ];

  if (opts.footer) lines.push(`_${opts.footer}_`);

  return lines.join('\n');
}

// ── Typed shorthand builders ───────────────────────────────────────────────────

export const R = {
  success(body: string, status?: string): string {
    return format({ type: 'success', body, status });
  },

  error(body: string, status?: string): string {
    return format({ type: 'error', body, status });
  },

  warning(body: string, status?: string): string {
    return format({ type: 'warning', body, status });
  },

  loading(label: string): string {
    return format({ type: 'loading', body: label, status: 'PROCESSING...' });
  },

  progress(steps: Array<{ label: string; done: boolean }>): string {
    const body = steps
      .map(s => `${s.done ? '✅' : '⏳'} ${s.label}`)
      .join('\n');
    const doneCount = steps.filter(s => s.done).length;
    return format({ type: 'progress', body, status: `${doneCount}/${steps.length} COMPLETE` });
  },

  info(body: string, status?: string): string {
    return format({ type: 'info', body, status });
  },

  owner(body: string): string {
    return format({ type: 'owner', body });
  },

  security(body: string): string {
    return format({ type: 'security', body });
  },

  ai(body: string): string {
    return format({ type: 'ai', body });
  },

  menu(title: string, items: string[]): string {
    const body = `*${title}*\n\n` + items.map(i => `${BULLET} ${i}`).join('\n');
    return format({ type: 'menu', body });
  },

  kick(phone: string, reason?: string): string {
    const body = `Target: *+${phone}*` + (reason ? `\nReason: ${reason}` : '');
    return format({ type: 'kick', body });
  },

  ban(phone: string, reason?: string): string {
    const body = `Target: *+${phone}*` + (reason ? `\nReason: ${reason}` : '');
    return format({ type: 'ban', body });
  },

  warn(phone: string, count: number, limit: number, reason?: string): string {
    const bar = '█'.repeat(count) + '░'.repeat(Math.max(0, limit - count));
    const body = [
      `Target: *+${phone}*`,
      `Warns:  [${bar}] ${count}/${limit}`,
      reason ? `Reason: ${reason}` : null,
    ].filter(Boolean).join('\n');
    return format({ type: 'warn', body });
  },

  permission(required: string, has: string): string {
    const body = `Required: *${required}*\nYour Role: *${has}*`;
    return format({ type: 'permission', body });
  },

  ping(data: {
    apiLatencyMs: number;
    baileysLatencyMs: number;
    memoryMb: number;
    cpuPercent: number;
    runtime: string;
    sessions: number;
    status: string;
  }): string {
    const body = [
      `⚡ *API Latency*    ${data.apiLatencyMs}ms`,
      `📡 *Baileys*        ${data.baileysLatencyMs}ms`,
      `💾 *Memory*         ${data.memoryMb}MB`,
      `🖥  *CPU*            ${data.cpuPercent}%`,
      `⏱  *Runtime*        ${data.runtime}`,
      `📱 *Sessions*       ${data.sessions}`,
      `🟢 *Status*         ${data.status}`,
    ].join('\n');
    return format({ type: 'ping', body });
  },

  promote(phone: string): string {
    return format({ type: 'promote', body: `Target: *+${phone}*` });
  },

  demote(phone: string): string {
    return format({ type: 'demote', body: `Target: *+${phone}*` });
  },

  group(body: string, status?: string): string {
    return format({ type: 'group', body, status });
  },

  sudo(body: string): string {
    return format({ type: 'sudo', body });
  },

  link(url: string, revoked = false): string {
    const body = revoked
      ? `New invite link generated:\n${url}`
      : `Group invite link:\n${url}`;
    return format({ type: 'link', body });
  },

  create(name: string, jid: string, link?: string): string {
    const body = [
      `Name: *${name}*`,
      `JID:  \`${jid}\``,
      link ? `Link: ${link}` : null,
    ].filter(Boolean).join('\n');
    return format({ type: 'create', body });
  },

  tag(memberCount: number, message?: string): string {
    const body = `Members tagged: *${memberCount}*` + (message ? `\nMessage: ${message}` : '');
    return format({ type: 'tag', body });
  },
};
