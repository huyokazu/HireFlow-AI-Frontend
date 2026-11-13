/** Pure time-slot math for interview scheduling. Wall-clock times are computed per IANA time zone. */

export type Interval = { start: string; end: string };

export const WORK_START_MINUTES = 9 * 60;
export const WORK_END_MINUTES = 18 * 60;
const SLOT_STEP_MINUTES = 30;
const MINUTE = 60_000;
/** Upper bound on candidate slots examined (60 days of 30-minute steps). */
const MAX_STEPS = 60 * 48;

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(date: Date, timeZone: string): WallClock {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, fmt);
  }
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday),
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** UTC instant for a wall-clock time in a zone (two passes settle DST offsets). */
export function zonedTime(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const target = Date.UTC(year, month - 1, day, 0, minutes);
  let guess = target;
  for (let i = 0; i < 2; i += 1) {
    const w = wallClock(new Date(guess), timeZone);
    const shown = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
    guess += target - shown;
  }
  return new Date(guess);
}

const isWeekend = (weekday: number) => weekday === 0 || weekday === 6;

/** 09:00 local on the business day `businessDays` after the day of `from` (weekends skipped). */
export function businessDayStart(from: Date, businessDays: number, timeZone: string): Date {
  const w = wallClock(from, timeZone);
  // Walk calendar days at local noon, which is never inside a DST transition.
  let cursor = zonedTime(w.year, w.month, w.day, 12 * 60, timeZone);
  let remaining = businessDays;
  while (remaining > 0) {
    cursor = new Date(cursor.getTime() + 24 * 60 * MINUTE);
    if (!isWeekend(wallClock(cursor, timeZone).weekday)) remaining -= 1;
  }
  const day = wallClock(cursor, timeZone);
  return zonedTime(day.year, day.month, day.day, WORK_START_MINUTES, timeZone);
}

/** Default interview window: next business day 09:00 until 09:00 five business days later. */
export function defaultInterviewWindow(now: Date, timeZone: string): Interval {
  const start = businessDayStart(now, 1, timeZone);
  return { start: start.toISOString(), end: businessDayStart(start, 5, timeZone).toISOString() };
}

export type SlotRequest = {
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  timeZone: string;
  busy: Interval[];
  /** Never propose a slot before this instant (defaults to the window start). */
  notBefore?: Date;
};

/**
 * First slot that starts on a 30-minute boundary (local time), lies within 09:00–18:00 on a
 * weekday in `timeZone`, fits inside the window and overlaps no busy interval. Null if none.
 */
export function findFreeSlot(req: SlotRequest): Interval | null {
  const windowEnd = new Date(req.windowEnd).getTime();
  const durationMs = req.durationMinutes * MINUTE;
  const busy = req.busy.map((b) => [new Date(b.start).getTime(), new Date(b.end).getTime()] as const);
  let start = Math.max(new Date(req.windowStart).getTime(), req.notBefore?.getTime() ?? 0);
  if (!Number.isFinite(start) || !Number.isFinite(windowEnd) || durationMs <= 0) return null;

  // Align up to the next local :00/:30 and drop seconds.
  start = Math.ceil(start / MINUTE) * MINUTE;
  const misalignment = wallClock(new Date(start), req.timeZone).minute % SLOT_STEP_MINUTES;
  if (misalignment) start += (SLOT_STEP_MINUTES - misalignment) * MINUTE;

  for (let step = 0; step < MAX_STEPS && start + durationMs <= windowEnd; step += 1, start += SLOT_STEP_MINUTES * MINUTE) {
    const end = start + durationMs;
    const local = wallClock(new Date(start), req.timeZone);
    const startMinutes = local.hour * 60 + local.minute;
    if (isWeekend(local.weekday)) continue;
    if (startMinutes < WORK_START_MINUTES || startMinutes + req.durationMinutes > WORK_END_MINUTES) continue;
    if (busy.some(([bStart, bEnd]) => start < bEnd && end > bStart)) continue;
    return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
  }
  return null;
}
