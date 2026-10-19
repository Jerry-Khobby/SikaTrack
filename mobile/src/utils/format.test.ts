import { formatCount, formatMoney, formatShortMonth } from './format';

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [48, '48'],
    [1962, '1,962'],
    [1234567, '1,234,567'],
  ])('writes %d as %s', (value, expected) => {
    expect(formatCount(value)).toBe(expected);
  });
});

describe('formatMoney', () => {
  it.each([
    ['5.00', 'GHS 5.00'],
    ['2723.4', 'GHS 2,723.40'],
    ['120', 'GHS 120.00'],
    ['-1243.40', '-GHS 1,243.40'],
  ])('writes %s as %s', (amount, expected) => {
    expect(formatMoney(amount, 'GHS')).toBe(expected);
  });
});

describe('formatShortMonth', () => {
  it('writes a date or a month as "Mon YYYY"', () => {
    expect(formatShortMonth('2025-11-01')).toBe('Nov 2025');
    expect(formatShortMonth('2026-09')).toBe('Sep 2026');
  });
});
