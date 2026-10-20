import { getCounterparty, listCounterparties, updateCounterparty } from '@/services/counterparties';
import { getCategorySpending, getHabits, getMonthSummary, getTopCounterparties, getTrend } from '@/services/summary';
import { DEFAULT_FILTERS, getTransaction, listFeePayments, listTransactions } from '@/services/transactions';
import { resetDevServer } from '@/test-utils';
import { currentMonth } from '@/utils/dates';
import { toPesewas } from '@/utils/money';
import { periodRange, trendRange } from '@/utils/periods';

const month = currentMonth();

beforeEach(() => {
  resetDevServer();
});

describe('dev server: trend', () => {
  it('has one point per month, the last one agreeing with the summary', async () => {
    const points = await getTrend('month', trendRange('month', month));
    const summary = await getMonthSummary(month);

    expect(points).toHaveLength(6);
    expect(points.at(-1)!.period).toBe(month);
    expect(points.at(-1)!.moneyOut).toBe(summary.moneyOut);
    expect(points.at(-1)!.fees).toBe(summary.fees);
  });

  it('fills every day and week, empty ones as zeros', async () => {
    const range = trendRange('day', month);
    const days = await getTrend('day', range);
    expect(days[0].period).toBe(range.from);
    expect(days.at(-1)!.period).toBe(range.to);

    const weeks = await getTrend('week', trendRange('week', month));
    expect(weeks).toHaveLength(8);
    for (const week of weeks) expect(new Date(week.period).getUTCDay()).toBe(1);
  });

  it('adds up the days to the month', async () => {
    const days = await getTrend('day', trendRange('day', month));
    const [current] = (await getTrend('month', periodRange(month, 'month'))).slice(-1);
    expect(days.reduce((sum, d) => sum + toPesewas(d.moneyOut), 0)).toBe(toPesewas(current.moneyOut));
  });
});

describe('dev server: categories by group', () => {
  it('splits spending and money in', async () => {
    const spending = await getCategorySpending(month, 'spending');
    const moneyIn = await getCategorySpending(month, 'money_in');
    expect(spending.items.every((i) => i.category.group === 'spending')).toBe(true);
    expect(moneyIn.items.every((i) => i.category.group === 'money_in')).toBe(true);
  });
});

describe('dev server: habits', () => {
  it('fills the week by time of day and every hour, adding up to the month', async () => {
    const habits = await getHabits(month);
    const spending = await getCategorySpending(month);

    expect(habits.grid).toHaveLength(28);
    expect(habits.byHour).toHaveLength(24);
    const grid = habits.grid.reduce((sum, c) => sum + toPesewas(c.amount), 0);
    const hours = habits.byHour.reduce((sum, h) => sum + toPesewas(h.amount), 0);
    expect(grid).toBe(toPesewas(spending.total));
    expect(hours).toBe(grid);
    expect(Number(habits.weekendShare)).toBeGreaterThanOrEqual(0);
    expect(Number(habits.weekendShare)).toBeLessThanOrEqual(1);
  });

  it('names the busiest cell as the peak', async () => {
    const habits = await getHabits(month);
    const busiest = [...habits.grid].sort((a, b) => toPesewas(b.amount) - toPesewas(a.amount))[0];
    expect(habits.peak).toEqual({ weekday: busiest.weekday, dayPart: busiest.dayPart });
  });
});

describe('dev server: counterparties', () => {
  it('ranks who you paid most this month', async () => {
    const top = await getTopCounterparties(month, 'out');
    expect(top.length).toBeLessThanOrEqual(10);
    const amounts = top.map((t) => toPesewas(t.amount));
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
  });

  it('searches and filters by kind', async () => {
    const all = await listCounterparties({ q: '', kind: null });
    const people = await listCounterparties({ q: '', kind: 'person' });
    expect(all.length).toBeGreaterThan(people.length);
    expect(people.every((p) => p.kind === 'person')).toBe(true);
    expect(all.some((c) => c.kind === 'own_wallet')).toBe(false);

    const first = all[0];
    const found = await listCounterparties({ q: first.name.slice(0, 4), kind: null });
    expect(found.map((c) => c.id)).toContain(first.id);
  });

  it('shows an alias everywhere, and the SMS name stays', async () => {
    const [first] = await listCounterparties({ q: '', kind: null });
    await updateCounterparty(first.id, { alias: 'My guy' });

    const renamed = await getCounterparty(first.id);
    expect(renamed.name).toBe('My guy');
    expect(renamed.originalName).toBe(first.name.toUpperCase());
    const page = await listTransactions({ ...DEFAULT_FILTERS, date: { from: '2000-01-01', to: '2100-01-01' }, counterparty: { id: first.id, name: '' } });
    expect(page.items.every((t) => t.counterparty.name === 'My guy')).toBe(true);

    await updateCounterparty(first.id, { alias: null });
    expect((await getCounterparty(first.id)).name).toBe(first.name);
  });

  it('files their payments under a default category, and can stop', async () => {
    const [first] = await listCounterparties({ q: '', kind: 'merchant' });
    const filters = { ...DEFAULT_FILTERS, date: { from: '2000-01-01', to: '2100-01-01' }, counterparty: { id: first.id, name: '' } };
    const before = (await listTransactions(filters)).items[0];

    await updateCounterparty(first.id, { defaultCategory: 'giving' });
    const after = await getTransaction(before.id);
    expect(after.category.id).toBe('giving');
    expect(after.categorySource).toBe('counterparty_default');

    await updateCounterparty(first.id, { defaultCategory: null });
    expect((await getTransaction(before.id)).category.id).toBe(before.category.id);
  });
});

describe('fee payments', () => {
  it('lists the month’s payments with a fee or tax, biggest first', async () => {
    const payments = await listFeePayments(periodRange(month, 'month'));
    const costs = payments.map((t) => toPesewas(t.fee) + toPesewas(t.tax));
    expect(costs.every((c) => c > 0)).toBe(true);
    expect([...costs].sort((a, b) => b - a)).toEqual(costs);
  });
});
