import { joinWithAnd } from './text';

describe('joinWithAnd', () => {
  it.each([
    [[], ''],
    [['MTN MoMo'], 'MTN MoMo'],
    [['MTN MoMo', 'GhanaPay'], 'MTN MoMo and GhanaPay'],
    [['MTN MoMo', 'GhanaPay', 'Telecel Cash'], 'MTN MoMo, GhanaPay and Telecel Cash'],
  ])('joins %j as "%s"', (items, expected) => {
    expect(joinWithAnd(items)).toBe(expected);
  });
});
