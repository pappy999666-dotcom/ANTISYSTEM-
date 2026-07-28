/**
 * PAPPYBOT V2 — Natural Language Time Parser
 *
 * Converts natural language time expressions to ISO timestamps and cron expressions.
 * No external dependencies — pure regex + Date math.
 */

export interface ParsedTime {
  isoString?: string;
  cron?: string;
  recurring: boolean;
  description: string;
}

/**
 * Parse a natural language time expression relative to `now`.
 * Returns null if no recognizable pattern is found.
 */
export function parseNaturalTime(text: string, now = Date.now()): ParsedTime | null {
  const lower = text.toLowerCase().trim();
  const base = new Date(now);

  // ── Recurring patterns → cron ─────────────────────────────────────────────

  // "every day at HH:MM" / "daily at HH:MM"
  const everyDayAt = lower.match(/every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (everyDayAt) {
    const cron = timeToCron(everyDayAt[1], everyDayAt[2] ?? '00', everyDayAt[3]);
    if (cron) return { cron, recurring: true, description: `daily at ${everyDayAt[0]}` };
  }

  const dailyAt = lower.match(/daily\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (dailyAt) {
    const cron = timeToCron(dailyAt[1], dailyAt[2] ?? '00', dailyAt[3]);
    if (cron) return { cron, recurring: true, description: `daily at ${dailyAt[0]}` };
  }

  // "every Monday/Tuesday/... at HH:MM"
  const everyWeekday = lower.match(
    /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/
  );
  if (everyWeekday) {
    const day = WEEKDAY_MAP[everyWeekday[1]];
    const hour = everyWeekday[2] ? parseHour(everyWeekday[2], everyWeekday[4]) : 9;
    const minute = everyWeekday[3] ? parseInt(everyWeekday[3]) : 0;
    return {
      cron: `${minute} ${hour} * * ${day}`,
      recurring: true,
      description: `every ${everyWeekday[1]}`,
    };
  }

  // "every hour" / "hourly"
  if (/every\s+hour|hourly/.test(lower)) {
    return { cron: '0 * * * *', recurring: true, description: 'every hour' };
  }

  // "every N minutes"
  const everyNMin = lower.match(/every\s+(\d+)\s+minutes?/);
  if (everyNMin) {
    const n = parseInt(everyNMin[1]);
    return { cron: `*/${n} * * * *`, recurring: true, description: `every ${n} minutes` };
  }

  // "every week" / "weekly"
  if (/every\s+week|weekly/.test(lower)) {
    return { cron: '0 9 * * 1', recurring: true, description: 'every week (Monday 9 AM)' };
  }

  // "every month" / "monthly" / "every first day of the month"
  if (/every\s+month|monthly|every\s+first\s+day/.test(lower)) {
    return { cron: '0 9 1 * *', recurring: true, description: 'every month (1st at 9 AM)' };
  }

  // ── One-time patterns → ISO ───────────────────────────────────────────────

  // "in N minutes/hours/days"
  const inN = lower.match(/in\s+(\d+)\s+(minute|hour|day|week)s?/);
  if (inN) {
    const n = parseInt(inN[1]);
    const unit = inN[2];
    const ms = UNIT_MS[unit] ?? 0;
    const target = new Date(base.getTime() + n * ms);
    return { isoString: target.toISOString(), recurring: false, description: `in ${n} ${unit}(s)` };
  }

  // "tomorrow at HH:MM [am/pm]"
  const tomorrowAt = lower.match(/tomorrow\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (tomorrowAt) {
    const target = new Date(base);
    target.setDate(target.getDate() + 1);
    setTimeParts(target, tomorrowAt[1], tomorrowAt[2] ?? '00', tomorrowAt[3]);
    return { isoString: target.toISOString(), recurring: false, description: 'tomorrow' };
  }

  // "tomorrow" (default 9 AM)
  if (/^tomorrow$/.test(lower)) {
    const target = new Date(base);
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
    return { isoString: target.toISOString(), recurring: false, description: 'tomorrow 9 AM' };
  }

  // "today at HH:MM [am/pm]"
  const todayAt = lower.match(/today\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (todayAt) {
    const target = new Date(base);
    setTimeParts(target, todayAt[1], todayAt[2] ?? '00', todayAt[3]);
    return { isoString: target.toISOString(), recurring: false, description: 'today' };
  }

  // "next Monday/Tuesday/... at HH:MM"
  const nextWeekday = lower.match(
    /next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?/
  );
  if (nextWeekday) {
    const targetDay = WEEKDAY_MAP[nextWeekday[1]];
    const target = nextDayOfWeek(base, targetDay);
    if (nextWeekday[2]) setTimeParts(target, nextWeekday[2], nextWeekday[3] ?? '00', nextWeekday[4]);
    else target.setHours(9, 0, 0, 0);
    return { isoString: target.toISOString(), recurring: false, description: `next ${nextWeekday[1]}` };
  }

  // "at HH:MM [am/pm]" (today, or tomorrow if past)
  const atTime = lower.match(/^at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (atTime) {
    const target = new Date(base);
    setTimeParts(target, atTime[1], atTime[2] ?? '00', atTime[3]);
    if (target.getTime() <= base.getTime()) target.setDate(target.getDate() + 1);
    return { isoString: target.toISOString(), recurring: false, description: 'today/tomorrow at time' };
  }

  return null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

const UNIT_MS: Record<string, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
  week: 604_800_000,
};

function parseHour(h: string, ampm?: string): number {
  let hour = parseInt(h);
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  return hour;
}

function timeToCron(h: string, m: string, ampm?: string): string | null {
  const hour = parseHour(h, ampm);
  const minute = parseInt(m);
  if (isNaN(hour) || isNaN(minute)) return null;
  return `${minute} ${hour} * * *`;
}

function setTimeParts(date: Date, h: string, m: string, ampm?: string): void {
  date.setHours(parseHour(h, ampm), parseInt(m || '0'), 0, 0);
}

function nextDayOfWeek(from: Date, targetDay: number): Date {
  const result = new Date(from);
  const current = result.getDay();
  const diff = (targetDay - current + 7) % 7 || 7;
  result.setDate(result.getDate() + diff);
  return result;
}
