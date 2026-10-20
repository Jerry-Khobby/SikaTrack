import { fromPesewas, isMoney, sumMoney, toPesewas } from './money';

describe('money as pesewas', () => {
  it.each([
    ['2723.40', 272340],
    ['2723.4', 272340],
    ['120', 12000],
    ['0.05', 5],
    ['-1243.40', -124340],
  ])('reads %s as %d pesewas', (amount, pesewas) => {
    expect(toPesewas(amount)).toBe(pesewas);
  });

  it('writes pesewas back with two places', () => {
    expect(fromPesewas(272340)).toBe('2723.40');
    expect(fromPesewas(5)).toBe('0.05');
    expect(fromPesewas(-124340)).toBe('-1243.40');
  });

  it('adds without float errors', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney(['40.00', '3.00', '150.00'])).toBe('193.00');
  });

  it('checks typed amounts', () => {
    expect(isMoney('12')).toBe(true);
    expect(isMoney('12.50')).toBe(true);
    expect(isMoney('12.505')).toBe(false);
    expect(isMoney('abc')).toBe(false);
  });
});
