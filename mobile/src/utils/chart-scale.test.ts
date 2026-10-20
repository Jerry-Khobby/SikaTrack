import { formatTick, niceTicks } from './chart-scale';

describe('niceTicks', () => {
  it.each([
    [3918.6, { top: 4000, ticks: [0, 2000, 4000] }],
    [30.7, { top: 40, ticks: [0, 20, 40] }],
    [612.5, { top: 750, ticks: [0, 250, 500, 750] }],
    [7, { top: 10, ticks: [0, 5, 10] }],
    [6, { top: 7.5, ticks: [0, 2.5, 5, 7.5] }],
    [1000, { top: 1000, ticks: [0, 500, 1000] }],
  ])('rounds %s up to clean ticks', (max, expected) => {
    expect(niceTicks(max, 2.5)).toEqual(expected);
  });

  it('always covers the largest value', () => {
    for (const max of [1, 9.99, 123, 4567, 89012]) {
      const { top, ticks } = niceTicks(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(top);
    }
  });

  it('gives an empty chart a scale', () => {
    expect(niceTicks(0)).toEqual({ top: 1, ticks: [0, 1] });
  });
});

describe('formatTick', () => {
  it.each([
    [0, '0'],
    [250, '250'],
    [2.5, '2.5'],
    [1000, '1K'],
    [1500, '1.5K'],
    [2_000_000, '2M'],
  ])('%s → %s', (value, text) => {
    expect(formatTick(value)).toBe(text);
  });
});
