import { isCurrentPeriod, periodAxisLabel, periodRange, periodTitle, trendRange } from './periods';

// Tue 20 Oct 2026, midday.
const now = Date.UTC(2026, 9, 20, 12);

describe('trendRange', () => {
  it('covers the days of the month, up to today', () => {
    expect(trendRange('day', '2026-10', now)).toEqual({ from: '2026-10-01', to: '2026-10-20' });
    expect(trendRange('day', '2026-09', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
  });

  it('covers the eight weeks ending with the month, from a Monday', () => {
    expect(trendRange('week', '2026-10', now)).toEqual({ from: '2026-08-31', to: '2026-10-20' });
  });

  it('covers the six months ending with the month', () => {
    expect(trendRange('month', '2026-10', now)).toEqual({ from: '2026-05-01', to: '2026-10-20' });
    expect(trendRange('month', '2026-02', now)).toEqual({ from: '2025-09-01', to: '2026-02-28' });
  });
});

describe('periodRange', () => {
  it('gives the days a period stands for, never past today', () => {
    expect(periodRange('2026-09', 'month', now)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('2026-10', 'month', now)).toEqual({ from: '2026-10-01', to: '2026-10-20' });
    expect(periodRange('2026-10-12', 'week', now)).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(periodRange('2026-10-19', 'week', now)).toEqual({ from: '2026-10-19', to: '2026-10-20' });
    expect(periodRange('2026-10-16', 'day', now)).toEqual({ from: '2026-10-16', to: '2026-10-16' });
  });
});

describe('labels', () => {
  it('names periods under the bars and over their figures', () => {
    expect(periodAxisLabel('2026-10', 'month')).toBe('Oct');
    expect(periodAxisLabel('2026-10-12', 'week')).toBe('12 Oct');
    expect(periodAxisLabel('2026-10-16', 'day')).toBe('16');
    expect(periodTitle('2026-10', 'month')).toBe('October 2026');
    expect(periodTitle('2026-10-12', 'week')).toBe('Week of 12 Oct');
    expect(periodTitle('2026-10-16', 'day')).toBe('Fri 16 Oct');
  });

  it('knows which month or week is still going', () => {
    expect(isCurrentPeriod('2026-10', 'month', now)).toBe(true);
    expect(isCurrentPeriod('2026-09', 'month', now)).toBe(false);
    expect(isCurrentPeriod('2026-10-19', 'week', now)).toBe(true);
  });
});
