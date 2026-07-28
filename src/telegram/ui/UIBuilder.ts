/**
 * PAPPYBOT V2 — Telegram UI Builder
 *
 * All message text and inline keyboard construction lives here.
 * Handlers never build raw strings — they call these helpers.
 */

import { InlineKeyboard } from 'grammy';
import { cb } from '../core/CallbackRouter';
import type { TelegramUser, PageState } from '../types/Telegram';
import type { SessionRuntime } from '../../types/Session';
import type { RuntimeSnapshot } from '../../services/RuntimeMonitor';

// ── Status badges ─────────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, string> = {
  connected: '🟢',
  connecting: '🟡',
  reconnecting: '🟡',
  disconnected: '🔴',
  logged_out: '⚫',
  qr_pending: '📱',
  initializing: '⏳',
  error: '❌',
  banned: '🚫',
};

export function statusBadge(status: string): string {
  return `${STATUS_ICON[status] ?? '⚪'} ${status.replace(/_/g, ' ')}`;
}

// ── Pairing status ───────────────────────────────────────────────────────────

const PAIRING_STATUS_LABEL: Record<string, string> = {
  initializing:    '⏳ Initializing Session...',
  loading_auth:    '🔐 Loading Authentication...',
  connecting:      '📡 Connecting...',
  waiting_qr:      '📷 Waiting For QR Scan...',
  waiting_code:    '🔢 Waiting For Pairing Code Entry...',
  authenticating:  '🔑 Authenticating...',
  loading_groups:  '👥 Loading Groups...',
  synchronizing:   '🔄 Synchronizing...',
  connected:       '🟢 Connected',
  ready:           '✅ Ready',
  disconnected:    '🔴 Disconnected',
  reconnecting:    '🔁 Reconnecting...',
  connection_lost: '⚠️ Connection Lost',
  logged_out:      '⚫ Logged Out',
  error:           '❌ Error',
};

export function pairingStatusText(sessionId: string, status: string, extra?: string): string {
  const label = PAIRING_STATUS_LABEL[status] ?? `⏳ ${status}`;
  return (
    `<b>📱 Pairing: <code>${sessionId}</code></b>\n\n` +
    `${label}` +
    (extra ? `\n\n<code>${extra}</code>` : '')
  );
}

export function sessionHealthText(
  snap: { sessionId: string; label?: string; status: string; phoneNumber?: string; healthScore: number; reconnectCount: number; missedHeartbeats: number; socketHealthy: boolean; runtimeMs: number; error?: string }
): string {
  const filled = Math.round(snap.healthScore / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  const runtimeMin = Math.floor(snap.runtimeMs / 60_000);
  return (
    `<b>📊 Session Health: ${snap.label ?? snap.sessionId}</b>\n\n` +
    `<blockquote>` +
    `Status: ${statusBadge(snap.status)}\n` +
    `Phone: <code>${snap.phoneNumber ?? 'N/A'}</code>\n` +
    `Health: [${bar}] ${snap.healthScore}/100\n` +
    `Socket: ${snap.socketHealthy ? '🟢 Healthy' : '🔴 Unhealthy'}\n` +
    `Reconnects: ${snap.reconnectCount}\n` +
    `Missed HB: ${snap.missedHeartbeats}\n` +
    `Runtime: ${runtimeMin}m` +
    (snap.error ? `\nError: <code>${snap.error}</code>` : '') +
    `</blockquote>`
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────

export function welcomeScreen(firstName: string): string {
  return (
    `<b>👋 Welcome to PAPPYBOT V2 Control Panel</b>\n\n` +
    `Hello <b>${firstName}</b>! This is your premium WhatsApp management dashboard.\n\n` +
    `<blockquote>Manage sessions, groups, anti-system, and more — all from Telegram.</blockquote>\n\n` +
    `Let's get you set up. What should we call you?\n` +
    `<i>Send your display name:</i>`
  );
}

export function domainPrompt(): string {
  return (
    `<b>🌐 Domain Configuration</b>\n\n` +
    `Enter your domain or base URL for the Intro Card system.\n\n` +
    `<blockquote>Example: <code>https://yourdomain.com</code></blockquote>\n\n` +
    `Don't have a domain? You can use a free dynamic DNS:\n` +
    `• <a href="https://www.duckdns.org">DuckDNS</a> — free subdomain\n` +
    `• <a href="https://freedns.afraid.org">FreeDNS</a> — free subdomain\n\n` +
    `Send your domain, or /skip to configure later.`
  );
}

export function registrationComplete(user: TelegramUser): string {
  return (
    `<b>✅ Registration Complete!</b>\n\n` +
    `<b>Name:</b> ${user.displayName}\n` +
    `<b>Port:</b> <code>${user.allocatedPort}</code>\n` +
    (user.domain ? `<b>Domain:</b> <code>${user.domain}</code>\n` : '') +
    `\nYour isolated port has been allocated. Use the dashboard to pair your first WhatsApp session.`
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function dashboardText(snap: RuntimeSnapshot, user: TelegramUser): string {
  const connected = snap.sessions.filter(s => s.status === 'connected').length;
  const disconnected = snap.sessions.filter(s => s.status === 'disconnected').length;
  const memMB = (snap.memory.rss / 1024 / 1024).toFixed(1);
  const uptimeMins = Math.floor((Date.now() - snap.capturedAt.getTime() + 60_000) / 60_000);

  return (
    `<b>📊 PAPPYBOT V2 Dashboard</b>\n` +
    `<blockquote>` +
    `👤 <b>${user.displayName}</b> · Port <code>${user.allocatedPort}</code>\n` +
    `🟢 Connected: <b>${connected}</b>  🔴 Disconnected: <b>${disconnected}</b>  📦 Total: <b>${snap.sessions.length}</b>\n` +
    `💾 Memory: <b>${memMB} MB</b>  ⏱ Uptime: <b>${uptimeMins}m</b>\n` +
    `📨 Recv: <b>${snap.throughput.messagesReceived}</b>  📤 Sent: <b>${snap.throughput.messagesSent}</b>\n` +
    `⚡ Commands: <b>${snap.throughput.commandsExecuted}</b>  ❌ Errors: <b>${snap.throughput.commandErrors}</b>` +
    `</blockquote>`
  );
}

export function dashboardKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ Pair Session', cb('pair_start'))
    .text('📱 Sessions', cb('sessions')).row()
    .text('👥 Groups', cb('groups'))
    .text('⚙️ Settings', cb('settings')).row()
    .text('📋 Logs', cb('logs'))
    .text('🔄 Refresh', cb('dashboard')).row()
    .text('💬 Support', cb('noop'))
    .text('👑 Owner', cb('owner_panel'));
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export function sessionsText(sessions: SessionRuntime[]): string {
  if (!sessions.length) {
    return `<b>📱 Sessions</b>\n\n<i>No sessions found. Pair your first WhatsApp account.</i>`;
  }
  return `<b>📱 Sessions</b> (${sessions.length})\n\n` +
    sessions.map(s =>
      `${statusBadge(s.state.status)} <b>${s.config.label ?? s.config.id}</b>\n` +
      `  📞 ${s.state.phoneNumber ?? 'Not connected'}`
    ).join('\n\n');
}

export function sessionsKeyboard(sessions: SessionRuntime[], page: PageState): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page.page * page.pageSize;
  const slice = sessions.slice(start, start + page.pageSize);

  for (const s of slice) {
    kb.text(
      `${STATUS_ICON[s.state.status] ?? '⚪'} ${s.config.label ?? s.config.id}`,
      cb('session_open', s.config.id)
    ).row();
  }

  const hasPrev = page.page > 0;
  const hasNext = start + page.pageSize < page.total;
  if (hasPrev || hasNext) {
    if (hasPrev) kb.text('◀️ Prev', cb('sessions', '', page.page - 1));
    kb.text(`${page.page + 1}/${Math.ceil(page.total / page.pageSize)}`, cb('noop'));
    if (hasNext) kb.text('Next ▶️', cb('sessions', '', page.page + 1));
    kb.row();
  }

  kb.text('➕ Pair New', cb('pair_start')).text('🔙 Back', cb('dashboard'));
  return kb;
}

export function sessionCardText(s: SessionRuntime): string {
  const uptime = s.state.connectedAt
    ? Math.floor((Date.now() - s.state.connectedAt.getTime()) / 60_000) + 'm'
    : '—';
  return (
    `<b>📱 Session: ${s.config.label ?? s.config.id}</b>\n\n` +
    `<blockquote>` +
    `Status: ${statusBadge(s.state.status)}\n` +
    `Phone: <code>${s.state.phoneNumber ?? 'N/A'}</code>\n` +
    `Name: ${s.state.displayName ?? 'N/A'}\n` +
    `Uptime: ${uptime}\n` +
    `Reconnects: ${s.state.reconnectAttempts}\n` +
    `Prefix: <code>${s.config.commandPrefix ?? '!'}</code>` +
    `</blockquote>`
  );
}

export function sessionCardKeyboard(sessionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Reconnect', cb('session_reconnect', sessionId))
    .text('✏️ Rename', cb('session_rename', sessionId)).row()
    .text('⚙️ Settings', cb('session_settings', sessionId))
    .text('👥 Groups', cb('groups', sessionId)).row()
    .text('🚪 Logout', cb('session_logout', sessionId))
    .text('🗑 Delete', cb('session_delete', sessionId)).row()
    .text('🔄 Refresh', cb('session_open', sessionId))
    .text('🔙 Back', cb('sessions'));
}

// ── Pairing ───────────────────────────────────────────────────────────────────

export function pairMethodKeyboard(sessionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔢 Pairing Code', cb('pair_code', sessionId))
    .text('📷 QR Code', cb('pair_qr', sessionId)).row()
    .text('🔙 Cancel', cb('sessions'));
}

export function pairingCodeText(code: string, phone: string): string {
  return (
    `<b>📱 PAIRING CODE</b>\n\n` +
    `<blockquote>Number: <code>+${phone}</code>\n\n` +
    `Code:\n<b><code>${code}</code></b>\n\n` +
    `<i>WhatsApp → Linked Devices → Link a Device → Link with phone number → Enter code above</i>\n\n` +
    `⏳ <i>Waiting for connection…</i></blockquote>`
  );
}

export function qrText(sessionId: string): string {
  return (
    `<b>📷 QR Code</b>\n\n` +
    `Session: <code>${sessionId}</code>\n\n` +
    `<blockquote>Scan this QR code with WhatsApp:\n` +
    `<b>Linked Devices → Link a Device → Scan QR code</b></blockquote>\n\n` +
    `<i>⏳ Generating QR code...</i>`
  );
}

// ── Groups ────────────────────────────────────────────────────────────────────

export function groupsText(sessionId: string, count: number): string {
  return `<b>👥 Groups</b> — Session: <code>${sessionId}</code>\n\n` +
    (count ? `Found <b>${count}</b> group(s). Select one to manage:` : `<i>No groups found or session not connected.</i>`);
}

export function groupsKeyboard(
  groups: Array<{ jid: string; name: string; isAdmin: boolean }>,
  sessionId: string,
  page: PageState
): InlineKeyboard {
  const kb = new InlineKeyboard();
  const start = page.page * page.pageSize;
  const slice = groups.slice(start, start + page.pageSize);

  for (const g of slice) {
    const label = `${g.isAdmin ? '👑' : '👤'} ${g.name.slice(0, 28)}`;
    kb.text(label, cb('group_open', `${sessionId}:${g.jid}`)).row();
  }

  const hasPrev = page.page > 0;
  const hasNext = start + page.pageSize < page.total;
  if (hasPrev || hasNext) {
    if (hasPrev) kb.text('◀️', cb('groups', sessionId, page.page - 1));
    kb.text(`${page.page + 1}/${Math.ceil(page.total / page.pageSize)}`, cb('noop'));
    if (hasNext) kb.text('▶️', cb('groups', sessionId, page.page + 1));
    kb.row();
  }

  kb.text('🔙 Back', cb('session_open', sessionId));
  return kb;
}

export function groupDashboardText(
  group: { subject: string; description?: string; participants: Array<{ jid: string; isAdmin: boolean }> },
  sessionId: string,
  groupJid: string
): string {
  const admins = group.participants.filter(p => p.isAdmin).length;
  return (
    `<b>👥 ${group.subject}</b>\n\n` +
    `<blockquote>` +
    `Members: <b>${group.participants.length}</b>  Admins: <b>${admins}</b>\n` +
    (group.description ? `Description: ${group.description.slice(0, 80)}\n` : '') +
    `JID: <code>${groupJid}</code>` +
    `</blockquote>`
  );
}

export function groupDashboardKeyboard(sessionId: string, groupJid: string): InlineKeyboard {
  const payload = `${sessionId}:${groupJid}`;
  return new InlineKeyboard()
    .text('🌉 Open Bridge', cb('group_bridge', payload))
    .text('⚙️ Settings', cb('group_settings', payload)).row()
    .text('👥 Participants', cb('group_participants', payload))
    .text('👋 Welcome', cb('group_welcome', payload)).row()
    .text('📝 Templates', cb('group_templates', payload))
    .text('🔄 Refresh', cb('group_open', payload)).row()
    .text('🔙 Back', cb('groups', sessionId));
}

// ── Bridge ────────────────────────────────────────────────────────────────────

export function bridgeActiveText(groupName: string, sessionId: string): string {
  return (
    `<b>🌉 Bridge Mode Active</b>\n\n` +
    `<blockquote>` +
    `Group: <b>${groupName}</b>\n` +
    `Session: <code>${sessionId}</code>` +
    `</blockquote>\n\n` +
    `Messages you send here will be forwarded to the WhatsApp group.\n` +
    `Commands are executed against this group automatically.\n\n` +
    `<i>Tap Exit Bridge to return to the dashboard.</i>`
  );
}

export function bridgeKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('🚪 Exit Bridge', cb('bridge_exit'));
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export function logsText(lines: string[]): string {
  const body = lines.length
    ? lines.map(l => `<code>${l}</code>`).join('\n')
    : '<i>No recent log entries.</i>';
  return `<b>📋 Live Logs</b>\n\n${body}`;
}

export function logsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔄 Refresh', cb('logs'))
    .text('🔙 Back', cb('dashboard'));
}

// ── Settings ──────────────────────────────────────────────────────────────────

export function settingsText(user: TelegramUser): string {
  return (
    `<b>⚙️ Settings</b>\n\n` +
    `<blockquote>` +
    `Name: <b>${user.displayName}</b>\n` +
    `Domain: <code>${user.domain ?? 'not set'}</code>\n` +
    `Prefix: <code>${user.commandPrefix}</code>\n` +
    `Language: ${user.language}\n` +
    `Timezone: ${user.timezone}\n` +
    `Notifications: ${user.notificationsEnabled ? '🔔 On' : '🔕 Off'}\n` +
    `Port: <code>${user.allocatedPort}</code>` +
    `</blockquote>`
  );
}

export function settingsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔔 Notifications', cb('settings_notifications'))
    .text('🌐 Domain', cb('settings_domain')).row()
    .text('⌨️ Prefix', cb('settings_prefix'))
    .text('📤 Export', cb('settings_export')).row()
    .text('📥 Import', cb('settings_import'))
    .text('🔙 Back', cb('dashboard'));
}

// ── Owner Panel ───────────────────────────────────────────────────────────────

export function ownerPanelText(userCount: number, sessionCount: number): string {
  return (
    `<b>👑 Owner Panel</b>\n\n` +
    `<blockquote>` +
    `Users: <b>${userCount}</b>\n` +
    `Sessions: <b>${sessionCount}</b>` +
    `</blockquote>`
  );
}

export function ownerPanelKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('👥 Users', cb('owner_users'))
    .text('📡 Broadcast', cb('owner_broadcast')).row()
    .text('🚫 Ban User', cb('owner_ban'))
    .text('✅ Unban', cb('owner_unban')).row()
    .text('📊 Stats', cb('owner_stats'))
    .text('🔧 Maintenance', cb('owner_maintenance')).row()
    .text('📢 Announce', cb('owner_announce'))
    .text('🔗 Force Join', cb('owner_force_join')).row()
    .text('🔙 Back', cb('dashboard'));
}

// ── Confirmation ──────────────────────────────────────────────────────────────

export function confirmKeyboard(yesAction: string, payload?: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirm', cb(yesAction, payload))
    .text('❌ Cancel', cb('confirm_no'));
}

// ── Loading / Progress ────────────────────────────────────────────────────────

export function loadingText(label: string): string {
  return `<i>⏳ ${label}...</i>`;
}

export function errorText(msg: string): string {
  return `<b>❌ Error</b>\n\n<code>${msg}</code>`;
}

export function successText(msg: string): string {
  return `<b>✅ ${msg}</b>`;
}
