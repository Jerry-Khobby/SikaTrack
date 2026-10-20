import { ApiError, api } from '@/api/client';
import { getBalanceHistory, getBalances } from '@/services/balances';
import { deleteBudget, listBudgets, saveBudget, usualMonthlySpend } from '@/services/budgets';
import {
  getRecurringOverview,
  getRecurringSeries,
  isStillCharging,
  listRecurringPayments,
  updateRecurring,
} from '@/services/recurring';
import { addWallet, listWallets, removeWallet, updateWallet } from '@/services/wallets';
import { resetDevServer } from '@/test-utils';
import { currentMonth } from '@/utils/dates';
import { toPesewas } from '@/utils/money';

const month = currentMonth();

beforeEach(() => {
  resetDevServer();
});

describe('dev server: budgets', () => {
  it('creates a budget, works out its state, and deletes it', async () => {
    const saved = await saveBudget('shopping', { limit: '1.00', alertThresholds: ['0.8', '1.0'] });
    expect(saved.id).toBe('bud_dev_shopping');
    expect(saved.limit).toBe('1.00');
    expect(saved.alertThresholds).toEqual(['0.8', '1.0']);

    const listed = (await listBudgets(month)).find((b) => b.category.id === 'shopping')!;
    expect(toPesewas(listed.remaining)).toBe(Math.max(0, toPesewas(listed.limit) - toPesewas(listed.spent)));
    if (toPesewas(listed.spent) > 100) expect(listed.state).toBe('over');

    await deleteBudget('shopping');
    expect((await listBudgets(month)).some((b) => b.category.id === 'shopping')).toBe(false);
  });

  it('replaces the limit of an existing budget', async () => {
    await saveBudget('food', { limit: '900.00', alertThresholds: ['1.0'] });
    const food = (await listBudgets(month)).find((b) => b.category.id === 'food')!;
    expect(food.limit).toBe('900.00');
    expect(food.alertThresholds).toEqual(['1.0']);
  });

  it('refuses a category that is not spending', async () => {
    await expect(api.put('/v1/budgets/salary', { limit: '10.00', alert_thresholds: [] })).rejects.toMatchObject({
      code: 'validation_error',
      status: 400,
    });
  });

  it('projects spending to the end of the month', async () => {
    for (const budget of await listBudgets(month)) {
      expect(toPesewas(budget.projected)).toBeGreaterThanOrEqual(toPesewas(budget.spent));
    }
  });

  it("knows what's usually spent on a category, or null with no history", async () => {
    expect(await usualMonthlySpend('food', month)).toMatch(/^\d+\.\d{2}$/);
    expect(await usualMonthlySpend('not_a_category', month)).toBeNull();
  });
});

describe('dev server: recurring payments', () => {
  it('splits active and stopped, and only counts active ones in the monthly cost', async () => {
    const all = await getRecurringOverview('all');
    const active = await getRecurringOverview('active');
    const stopped = await getRecurringOverview('stopped');

    expect(stopped.series.map((s) => s.counterparty.name)).toEqual(['Boomplay Premium']);
    expect(active.series.length + stopped.series.length).toBe(all.series.length);
    const sum = active.series.reduce((total, s) => total + toPesewas(s.monthlyCost), 0);
    expect(toPesewas(all.monthlyCost)).toBe(sum);
  });

  it('flags a series the user meant to cancel that is still charging', async () => {
    const netflix = await getRecurringSeries('rec_dev_netflix');
    expect(netflix.userState).toBe('cancel_planned');
    expect(isStillCharging(netflix)).toBe(true);
  });

  it('records a decision and a new label', async () => {
    const updated = await updateRecurring('rec_dev_kwesi', { userState: 'expected', label: 'Rent share' });
    expect(updated.userState).toBe('expected');
    expect(updated.label).toBe('Rent share');
    expect((await getRecurringSeries('rec_dev_kwesi')).label).toBe('Rent share');
  });

  it('hides a series marked not recurring', async () => {
    await updateRecurring('rec_dev_kwesi', { userState: 'not_recurring' });
    expect((await getRecurringOverview('all')).series.some((s) => s.id === 'rec_dev_kwesi')).toBe(false);
  });

  it('lists the payments of a series, newest first', async () => {
    const payments = await listRecurringPayments('rec_dev_dstv');
    expect(payments.length).toBeGreaterThan(1);
    expect(payments.every((t) => t.recurringId === 'rec_dev_dstv')).toBe(true);
    const dates = payments.map((t) => t.occurredAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('answers not_found for an unknown series', async () => {
    await expect(getRecurringSeries('rec_nope')).rejects.toBeInstanceOf(ApiError);
  });
});

describe('dev server: wallets and balance history', () => {
  it('adds, relabels and removes a wallet, and balances follow', async () => {
    const added = await addWallet({
      provider: 'mtn_momo',
      phoneNumber: '+233245550000',
      accountName: 'AMA SERWAA',
      label: 'Side hustle',
    });
    await updateWallet(added.id, { label: 'Shop till' });
    expect((await listWallets()).find((w) => w.id === added.id)?.label).toBe('Shop till');

    await removeWallet(added.id);
    expect((await listWallets()).some((w) => w.id === added.id)).toBe(false);
    expect((await getBalances()).wallets.some((w) => w.id === added.id)).toBe(false);
  });

  it('gives one end-of-day line per wallet across the range', async () => {
    const history = await getBalanceHistory('1M');
    const wallets = await listWallets();

    expect(history.series.map((s) => s.walletId).sort()).toEqual(wallets.map((w) => w.id).sort());
    for (const series of history.series) {
      expect(series.points.length).toBeLessThanOrEqual(30);
      expect(series.points.at(-1)?.date).toBe(history.to);
    }
    expect(history.daysBelowThreshold).toBeGreaterThanOrEqual(0);
    expect(history.threshold).toBe('5.00');
  });

  it('covers longer ranges', async () => {
    const three = await getBalanceHistory('3M');
    const six = await getBalanceHistory('6M');
    expect(six.from < three.from).toBe(true);
  });
});
