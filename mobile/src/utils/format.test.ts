import {
  formatChange,
  formatCount,
  formatDirectedMoney,
  formatMoney,
  formatMoneyShort,
  formatMoneyWhole,
  formatShare,
  formatShortMonth,
  formatSignedMoney,
} from './format';

describe('formatMoneyWhole', () => {
  it.each([
    ['2723.40', 'GHS 2,723'],
    ['2723.50', 'GHS 2,724'],
    ['-1243.40', '-GHS 1,243'],
  ])('rounds %s to %s', (amount, expected) => {
    expect(formatMoneyWhole(amount, 'GHS')).toBe(expected);
  });
});

describe('formatMoneyShort', () => {
  it('drops .00 but keeps real pesewas', () => {
    expect(formatMoneyShort('1122.00', 'GHS')).toBe('GHS 1,122');
    expect(formatMoneyShort('612.50', 'GHS')).toBe('GHS 612.50');
  });
});

describe('directed and signed money', () => {
  it('puts + on money in and nothing on money out', () => {
    expect(formatDirectedMoney('150.00', 'in', 'GHS')).toBe('+GHS 150.00');
    expect(formatDirectedMoney('40.00', 'out', 'GHS')).toBe('GHS 40.00');
    expect(formatDirectedMoney('40.00', 'out', 'GHS', { signed: true })).toBe('-GHS 40.00');
  });

  it('signs a net amount either way', () => {
    expect(formatSignedMoney('-1243.40', 'GHS', { whole: true })).toBe('-GHS 1,243');
    expect(formatSignedMoney('120.00', 'GHS')).toBe('+GHS 120.00');
    expect(formatSignedMoney('0.00', 'GHS')).toBe('GHS 0.00');
  });
});

describe('shares and changes', () => {
  it('writes a share as a whole percentage', () => {
    expect(formatShare('0.412')).toBe('41%');
  });

  it('writes a change with its direction', () => {
    expect(formatChange('-0.305')).toEqual({ text: '30.5%', down: true });
    expect(formatChange('0.18')).toEqual({ text: '18%', down: false });
  });
});

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
