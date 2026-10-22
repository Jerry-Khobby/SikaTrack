/**
 * Dates and times as docs/ui-spec.md §3 shows them. The API sends UTC, and
 * Ghana is UTC+0 with no daylight saving, so UTC fields are the local ones.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-20` for a timestamp. */
export function toIsoDate(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today as `2026-10-20`. */
export function today(now = Date.now()) {
  return toIsoDate(now);
}

/** The current month as `2026-10`. */
export function currentMonth(now = Date.now()) {
  return toIsoDate(now).slice(0, 7);
}

function dayDifference(iso: string, now: number) {
  return Math.round((Date.parse(today(now)) - Date.parse(iso.slice(0, 10))) / DAY_MS);
}

/** `09:32` */
export function formatTime(iso: string) {
  const date = new Date(iso);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** `Fri 16 Oct`, with the year when it isn't this year. */
export function formatWeekdayDate(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const year = date.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ` ${date.getUTCFullYear()}` : '';
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}${year}`;
}

/** `1 Oct`, with the year when it isn't this year: `14 Sep 2025`. */
export function formatDayMonth(iso: string, now = Date.now()) {
  const date = new Date(iso);
  const year = date.getUTCFullYear() !== new Date(now).getUTCFullYear() ? ` ${date.getUTCFullYear()}` : '';
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}${year}`;
}

/** `15 Nov 2025`, always with the year. */
export function formatFullDate(iso: string) {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Day headers in lists: `Today`, `Yesterday`, `Fri 16 Oct`. */
export function formatDayHeader(iso: string, now = Date.now()) {
  const days = dayDifference(iso, now);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatWeekdayDate(iso, now);
}

/** `Today, 09:32`, `Yesterday, 09:32` or `14 Sep, 09:32`. */
export function formatDateTime(iso: string, now = Date.now()) {
  const days = dayDifference(iso, now);
  const date = new Date(iso);
  const day =
    days === 0
      ? 'Today'
      : days === 1
        ? 'Yesterday'
        : `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
  return `${day}, ${formatTime(iso)}`;
}

/** `Just now`, `12 min ago`, `2 h ago`, `3 days ago`, then `Fri 16 Oct`. */
export function formatTimeAgo(iso: string, now = Date.now()) {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  const days = Math.floor(minutes / (24 * 60));
  if (days < 4) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatWeekdayDate(iso, now);
}

/** `2026-09` → `September`. */
export function formatMonthName(month: string) {
  return MONTHS_LONG[Number(month.slice(5, 7)) - 1];
}

/** `2026-09` → `September 2026`. */
export function formatMonthLong(month: string) {
  return `${formatMonthName(month)} ${month.slice(0, 4)}`;
}

/** The month before `2026-10`: `2026-09`. */
export function previousMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7);
}

/** Days left in the month after today, e.g. 11 on 20 Oct. */
export function daysLeftInMonth(now = Date.now()) {
  const date = new Date(now);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  return last - date.getUTCDate();
}

/** `Good morning`, `Good afternoon` or `Good evening` for the phone's clock. */
export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export type DatePreset = 'this_month' | 'last_month' | 'last_30_days' | 'last_3_months' | 'this_year';

export const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'this_year', label: 'This year' },
];

/** The inclusive `from`/`to` dates a preset stands for. */
export function presetRange(preset: DatePreset, now = Date.now()) {
  const date = new Date(now);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (preset) {
    case 'this_month':
      return { from: toIsoDate(Date.UTC(year, month, 1)), to: today(now) };
    case 'last_month':
      return { from: toIsoDate(Date.UTC(year, month - 1, 1)), to: toIsoDate(Date.UTC(year, month, 0)) };
    case 'last_30_days':
      return { from: toIsoDate(now - 29 * DAY_MS), to: today(now) };
    case 'last_3_months':
      return { from: toIsoDate(Date.UTC(year, month - 2, 1)), to: today(now) };
    case 'this_year':
      return { from: toIsoDate(Date.UTC(year, 0, 1)), to: today(now) };
  }
}

/** One query can cover at most three years (docs/ui-spec.md S13). */
export const MAX_RANGE_DAYS = 3 * 366;

/** The longest range one query may ask for, ending today: "everything" as far as the API allows. */
export function allTimeRange(now = Date.now()) {
  return { from: toIsoDate(now - (MAX_RANGE_DAYS - 1) * DAY_MS), to: today(now) };
}

/** Checks a typed `YYYY-MM-DD` range: real dates, in order, not in the future, at most three years. */
export function validateRange(from: string, to: string, now = Date.now()) {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to)) return 'Use the format YYYY-MM-DD.';
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (Number.isNaN(start) || Number.isNaN(end) || toIsoDate(start) !== from || toIsoDate(end) !== to) {
    return 'That date doesn\'t exist.';
  }
  if (start > end) return 'The start date must come before the end date.';
  if (to > today(now)) return 'The end date can\'t be in the future.';
  if ((end - start) / DAY_MS > MAX_RANGE_DAYS) return 'Pick at most three years.';
  return null;
}
