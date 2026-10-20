import { getBalances } from '@/services/balances';
import { listBudgets } from '@/services/budgets';
import { listCategories } from '@/services/categories';
import { listInsights } from '@/services/insights';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notifications';
import { getRecurringOverview } from '@/services/recurring';
import { getCategorySpending, getMonthSummary, listMonthsWithData } from '@/services/summary';
import { getSyncStatus } from '@/services/sync';
import {
  DEFAULT_FILTERS,
  getTransaction,
  listTransactions,
  updateTransaction,
  type TransactionFilters,
} from '@/services/transactions';
import { resetDevServer } from '@/test-utils';
import { currentMonth } from '@/utils/dates';
import { toPesewas } from '@/utils/money';

const month = currentMonth();
const thisMonth: TransactionFilters = { ...DEFAULT_FILTERS, date: { preset: 'this_month' } };

async function allOf(filters: TransactionFilters) {
  const items = [];
  let cursor: string | null = null;
  do {
    const page = await listTransactions(filters, cursor, 100);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

beforeEach(() => resetDevServer());

describe('dev server: summaries agree with the transactions', () => {
  it("money out is the sum of this month's payments, own transfers left out", async () => {
    const [summary, items] = await Promise.all([getMonthSummary(month), allOf(thisMonth)]);
    const out = items.filter((t) => t.direction === 'out' && !t.isOwnTransfer);

    expect(toPesewas(summary.moneyOut)).toBe(out.reduce((sum, t) => sum + toPesewas(t.amount), 0));
    expect(summary.spendingTransactions).toBe(out.length);
    expect(toPesewas(summary.net)).toBe(toPesewas(summary.moneyIn) - toPesewas(summary.moneyOut));
  });

  it('category spending adds up to its total, largest first', async () => {
    const spending = await getCategorySpending(month);
    const amounts = spending.items.map((item) => toPesewas(item.amount));

    expect(amounts.reduce((a, b) => a + b, 0)).toBe(toPesewas(spending.total));
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
  });

  it('lists months with data, newest first, including this one', async () => {
    const months = await listMonthsWithData();
    expect(months[0]).toBe(month);
    expect(months).toEqual([...months].sort().reverse());
  });

  it("balances are each wallet's latest balance, with a total", async () => {
    const balances = await getBalances();
    expect(balances.wallets.length).toBeGreaterThan(0);
    expect(toPesewas(balances.total)).toBe(
      balances.wallets.reduce((sum, w) => sum + toPesewas(w.balance), 0),
    );
  });

  it('budgets, insights, recurring and sync status answer in the contract shape', async () => {
    const [budgets, insights, recurring, sync] = await Promise.all([
      listBudgets(month),
      listInsights(month),
      getRecurringOverview(),
      getSyncStatus(),
    ]);
    expect(budgets.every((b) => ['on_track', 'warning', 'over'].includes(b.state))).toBe(true);
    expect(insights.every((i) => ['info', 'tip', 'warning'].includes(i.severity))).toBe(true);
    expect(toPesewas(recurring.monthlyCost)).toBe(
      recurring.series.reduce((sum, s) => sum + toPesewas(s.monthlyCost), 0),
    );
    expect(sync.provisionalTransactions).toBeGreaterThanOrEqual(0);
  });
});

describe('dev server: GET /v1/transactions', () => {
  it('pages through newest first', async () => {
    const first = await listTransactions(DEFAULT_FILTERS, null, 10);
    expect(first.items).toHaveLength(10);
    expect(first.nextCursor).not.toBeNull();

    const second = await listTransactions(DEFAULT_FILTERS, first.nextCursor, 10);
    expect(second.items[0].occurredAt <= first.items[9].occurredAt).toBe(true);
    expect(second.items.map((t) => t.id)).not.toContain(first.items[0].id);
  });

  it('hides own transfers unless asked', async () => {
    const hidden = await allOf(DEFAULT_FILTERS);
    const shown = await allOf({ ...DEFAULT_FILTERS, includeOwnTransfers: true });

    expect(hidden.some((t) => t.isOwnTransfer)).toBe(false);
    expect(shown.some((t) => t.isOwnTransfer)).toBe(true);
  });

  it('filters by direction, category, amount and search', async () => {
    const moneyIn = await allOf({ ...DEFAULT_FILTERS, direction: 'in' });
    expect(moneyIn.length).toBeGreaterThan(0);
    expect(moneyIn.every((t) => t.direction === 'in')).toBe(true);

    const food = await allOf({ ...DEFAULT_FILTERS, categories: ['food'] });
    expect(food.every((t) => t.category.id === 'food')).toBe(true);

    const big = await allOf({ ...DEFAULT_FILTERS, minAmount: '100' });
    expect(big.every((t) => toPesewas(t.amount) >= 10000)).toBe(true);

    const search = await allOf({ ...DEFAULT_FILTERS, q: 'yango' });
    expect(search.every((t) => t.counterparty.name.toLowerCase().includes('yango'))).toBe(true);
  });
});

describe('dev server: correcting a transaction', () => {
  it('sets a category, marks it as yours, and can apply it to the counterparty', async () => {
    const [target] = (await listTransactions({ ...DEFAULT_FILTERS, categories: ['food'] })).items;

    const updated = await updateTransaction(target.id, { category: 'shopping', applyToCounterparty: true });
    expect(updated.category.id).toBe('shopping');
    expect(updated.categorySource).toBe('user');

    const others = await allOf({ ...DEFAULT_FILTERS, counterparty: { id: target.counterparty.id, name: '' } });
    expect(others.every((t) => t.category.id === 'shopping')).toBe(true);
  });

  it('saves a note and returns the detail fields', async () => {
    const [target] = (await listTransactions(DEFAULT_FILTERS)).items;
    await updateTransaction(target.id, { note: 'Lunch with team' });

    const detail = await getTransaction(target.id);
    expect(detail.note).toBe('Lunch with team');
    expect(detail.smsText).toEqual(expect.any(String));
  });

  it('answers not_found for an unknown id', async () => {
    await expect(getTransaction('txn_missing')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('dev server: notifications', () => {
  it('marks one, then all, as read', async () => {
    const before = await listNotifications();
    const unread = before.items.find((n) => !n.readAt);
    expect(unread).toBeDefined();

    await markNotificationRead(unread!.id);
    expect((await listNotifications()).unread).toBe(before.unread - 1);

    await markAllNotificationsRead();
    expect((await listNotifications()).unread).toBe(0);
  });
});

describe('dev server: an account with no MoMo SMS', () => {
  it('has no transactions and no spending', async () => {
    process.env.EXPO_PUBLIC_EMPTY_INBOX = 'true';
    try {
      expect((await listTransactions(DEFAULT_FILTERS)).items).toEqual([]);
      expect((await getMonthSummary(month)).spendingTransactions).toBe(0);
    } finally {
      delete process.env.EXPO_PUBLIC_EMPTY_INBOX;
    }
  });
});

describe('dev server: categories', () => {
  it('lists every category, marking the ones people can pick', async () => {
    const categories = await listCategories();
    expect(categories.find((c) => c.id === 'food')).toMatchObject({ group: 'spending', userSelectable: true });
    expect(categories.find((c) => c.id === 'own_transfers')?.userSelectable).toBe(false);
  });
});
