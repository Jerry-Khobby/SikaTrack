import {
  daysLeftInMonth,
  formatDateTime,
  formatDayHeader,
  formatMonthLong,
  formatTime,
  formatTimeAgo,
  greeting,
  presetRange,
  previousMonth,
  validateRange,
} from './dates';

const NOW = Date.parse('2026-10-20T15:00:00Z');

describe('day and time labels', () => {
  it('names today and yesterday, then the weekday and date', () => {
    expect(formatDayHeader('2026-10-20T09:32:00Z', NOW)).toBe('Today');
    expect(formatDayHeader('2026-10-19T18:40:00Z', NOW)).toBe('Yesterday');
    expect(formatDayHeader('2026-10-16T13:15:00Z', NOW)).toBe('Fri 16 Oct');
    expect(formatDayHeader('2025-11-03T10:00:00Z', NOW)).toBe('Mon 3 Nov 2025');
  });

  it('writes times in UTC, which is Ghana time', () => {
    expect(formatTime('2026-10-20T09:32:00Z')).toBe('09:32');
    expect(formatDateTime('2026-10-20T09:32:00Z', NOW)).toBe('Today, 09:32');
    expect(formatDateTime('2026-09-14T09:32:00Z', NOW)).toBe('14 Sep, 09:32');
  });

  it('says how long ago, then switches to the date', () => {
    expect(formatTimeAgo('2026-10-20T14:59:30Z', NOW)).toBe('Just now');
    expect(formatTimeAgo('2026-10-20T14:48:00Z', NOW)).toBe('12 min ago');
    expect(formatTimeAgo('2026-10-20T13:00:00Z', NOW)).toBe('2 h ago');
    expect(formatTimeAgo('2026-10-17T15:00:00Z', NOW)).toBe('3 days ago');
    expect(formatTimeAgo('2026-10-12T09:00:00Z', NOW)).toBe('Mon 12 Oct');
  });
});

describe('months', () => {
  it('names a month and the one before it', () => {
    expect(formatMonthLong('2026-09')).toBe('September 2026');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });

  it('counts the days left after today', () => {
    expect(daysLeftInMonth(NOW)).toBe(11);
  });
});

describe('greeting', () => {
  it.each([
    [8, 'Good morning'],
    [13, 'Good afternoon'],
    [20, 'Good evening'],
  ])('at %d:00 says %s', (hour, expected) => {
    const date = new Date();
    date.setHours(hour, 0, 0, 0);
    expect(greeting(date)).toBe(expected);
  });
});

describe('date presets', () => {
  it.each([
    ['this_month', '2026-10-01', '2026-10-20'],
    ['last_month', '2026-09-01', '2026-09-30'],
    ['last_30_days', '2026-09-21', '2026-10-20'],
    ['last_3_months', '2026-08-01', '2026-10-20'],
    ['this_year', '2026-01-01', '2026-10-20'],
  ] as const)('%s runs from %s to %s', (preset, from, to) => {
    expect(presetRange(preset, NOW)).toEqual({ from, to });
  });
});

describe('validateRange', () => {
  it('accepts a real range in the past', () => {
    expect(validateRange('2026-09-01', '2026-09-30', NOW)).toBeNull();
  });

  it.each([
    ['2026-9-1', '2026-09-30', 'Use the format YYYY-MM-DD.'],
    ['2026-02-30', '2026-03-01', "That date doesn't exist."],
    ['2026-10-01', '2026-09-01', 'The start date must come before the end date.'],
    ['2026-10-01', '2026-10-25', "The end date can't be in the future."],
    ['2022-01-01', '2026-10-01', 'Pick at most three years.'],
  ])('refuses %s to %s', (from, to, message) => {
    expect(validateRange(from, to, NOW)).toBe(message);
  });
});
