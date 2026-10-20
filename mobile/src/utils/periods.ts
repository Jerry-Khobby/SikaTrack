/**
 * The periods the Trend chart walks through: days of a month, the weeks up to
 * it, or the months before it. The API names a week by its Monday.
 */
import { toIsoDate } from './dates';

export type Granularity = 'day' | 'week' | 'month';

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** How many periods the chart shows for each granularity. */
export const TREND_LENGTH: Record<Granularity, number> = { day: 31, week: 8, month: 6 };

function monthEnd(month: string, now: number) {
  const [year, m] = month.split('-').map(Number);
  return Math.min(Date.UTC(year, m, 0), Date.parse(toIsoDate(now)));
}

const mondayOf = (ms: number) => ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS;

/**
 * The dates the chart covers for a month: its days, the eight weeks ending with
 * it, or the six months ending with it. Never past today.
 */
export function trendRange(granularity: Granularity, month: string, now = Date.now()) {
  const [year, m] = month.split('-').map(Number);
  const to = monthEnd(month, now);
  if (granularity === 'day') return { from: `${month}-01`, to: toIsoDate(to) };
  if (granularity === 'week') return { from: toIsoDate(mondayOf(to) - 7 * (TREND_LENGTH.week - 1) * DAY_MS), to: toIsoDate(to) };
  return { from: toIsoDate(Date.UTC(year, m - TREND_LENGTH.month, 1)), to: toIsoDate(to) };
}

/** The first and last day a period stands for, cut off at today. */
export function periodRange(period: string, granularity: Granularity, now = Date.now()) {
  const today = Date.parse(toIsoDate(now));
  if (granularity === 'day') return { from: period, to: period };
  if (granularity === 'week') {
    const start = Date.parse(period);
    return { from: period, to: toIsoDate(Math.min(start + 6 * DAY_MS, today)) };
  }
  const [year, m] = period.split('-').map(Number);
  return { from: `${period}-01`, to: toIsoDate(Math.min(Date.UTC(year, m, 0), today)) };
}

/** Under a bar: `Oct` for a month, `12 Oct` for a week, `16` for a day. */
export function periodAxisLabel(period: string, granularity: Granularity) {
  if (granularity === 'month') return MONTHS_SHORT[Number(period.slice(5, 7)) - 1];
  const date = new Date(period);
  if (granularity === 'day') return String(date.getUTCDate());
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

/** Over the tapped bar's figures: `October 2026`, `Week of 12 Oct`, `Fri 16 Oct`. */
export function periodTitle(period: string, granularity: Granularity) {
  if (granularity === 'month') return `${MONTHS_LONG[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`;
  const date = new Date(period);
  const dayMonth = `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
  return granularity === 'week' ? `Week of ${dayMonth}` : `${WEEKDAYS[date.getUTCDay()]} ${dayMonth}`;
}

/** Whether a period is still going, so its figures are "so far". */
export function isCurrentPeriod(period: string, granularity: Granularity, now = Date.now()) {
  const { from, to } = periodRange(period, granularity, now);
  const today = toIsoDate(now);
  return from <= today && today <= to && (granularity === 'day' ? false : to === today);
}
