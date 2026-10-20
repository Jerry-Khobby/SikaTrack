/**
 * Answers API requests inside the app while there's no backend, with the JSON
 * shapes from backend/docs/api-contract.md, worked out from the sample dataset.
 * Start with EXPO_PUBLIC_DEV_API_FAILURE=true to make every request fail.
 */
import { fromPesewas, toPesewas } from '@/utils/money';

import { ApiError } from '../errors';
import type {
  ApiBalances,
  ApiBudgets,
  ApiCategories,
  ApiCategorySummary,
  ApiInsight,
  ApiNotifications,
  ApiPage,
  ApiRecurringList,
  ApiSummary,
  ApiSyncStatus,
  ApiTransaction,
  ApiTransactionDetail,
  ApiTransactionPatch,
  ApiTrend,
  ApiWallet,
} from '../types';
import { BUDGETS, CATEGORIES, LOW_BALANCE_THRESHOLD, RECURRING_SERIES, categoryRef } from './catalog';
import { getDataset } from './dataset';

type Query = Record<string, unknown>;

/** A little delay so loading states show; tests set it to 0. */
const latency = () => Number(process.env.EXPO_PUBLIC_DEV_API_LATENCY_MS ?? 250);
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const requestId = () => Math.random().toString(16).slice(2, 10) + '-' + Math.random().toString(16).slice(2, 6);
const fraction = (value: number) => value.toFixed(3);

function notFound(): never {
  throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' }, requestId());
}

/** `YYYY-MM` → its first and last day, cut off at today for the current month. */
function monthRange(month: string) {
  const [year, m] = month.split('-').map(Number);
  const start = Date.UTC(year, m - 1, 1);
  const end = Date.UTC(year, m, 0);
  const today = Math.floor(Date.now() / DAY_MS) * DAY_MS;
  const to = Math.min(end, today);
  return { from: isoDate(start), to: isoDate(to), days: Math.round((to - start) / DAY_MS) + 1, fullDays: Math.round((end - start) / DAY_MS) + 1 };
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth(month: string) {
  const [year, m] = month.split('-').map(Number);
  return new Date(Date.UTC(year, m - 2, 1)).toISOString().slice(0, 7);
}

function inRange(t: ApiTransaction, from: string, to: string) {
  const day = t.occurred_at.slice(0, 10);
  return day >= from && day <= to;
}

const counted = (t: ApiTransaction) => !t.is_own_transfer;
const total = (items: ApiTransaction[], pick: (t: ApiTransaction) => string = (t) => t.amount) =>
  items.reduce((sum, t) => sum + toPesewas(pick(t)), 0);

async function periodTransactions(query: Query) {
  const { transactions } = await getDataset();
  const month = typeof query.month === 'string' ? query.month : undefined;
  const range = month
    ? monthRange(month)
    : {
        from: String(query.from ?? isoDate(Date.now() - 29 * DAY_MS)),
        to: String(query.to ?? isoDate(Date.now())),
        days: 30,
        fullDays: 30,
      };
  return { range, items: transactions.filter((t) => counted(t) && inRange(t, range.from, range.to)) };
}

function recurringList(transactions: ApiTransaction[]): ApiRecurringList {
  const items = RECURRING_SERIES.flatMap((series) => {
    const payments = transactions.filter((t) => t.recurring_id === series.id);
    if (!payments.length) return [];
    const monthly = series.intervalDays === 1 ? series.amount * 30 : series.amount;
    return [{
      id: series.id,
      label: series.label,
      counterparty: series.counterparty,
      category: categoryRef(series.category),
      rhythm: series.rhythm,
      interval_days: series.intervalDays,
      typical_amount: fromPesewas(series.amount * 100),
      payments: payments.length,
      first_paid_at: payments[payments.length - 1].occurred_at,
      last_paid_at: payments[0].occurred_at,
      status: 'active' as const,
      monthly_cost: fromPesewas(monthly * 100),
      user_state: null,
    }];
  });
  return { monthly_cost: fromPesewas(items.reduce((sum, item) => sum + toPesewas(item.monthly_cost), 0)), items };
}

function spendingByCategory(items: ApiTransaction[]) {
  const byCategory = new Map<string, ApiTransaction[]>();
  for (const t of items.filter((t) => t.direction === 'out' && t.category.group === 'spending')) {
    byCategory.set(t.category.id, [...(byCategory.get(t.category.id) ?? []), t]);
  }
  return [...byCategory.entries()]
    .map(([id, list]) => ({ id, list, amount: total(list) }))
    .sort((a, b) => b.amount - a.amount);
}

async function budgets(month: string): Promise<ApiBudgets> {
  const { range, items } = await periodTransactions({ month });
  const spending = spendingByCategory(items);
  return {
    month,
    items: BUDGETS.map((budget, index) => {
      const spent = spending.find((s) => s.id === budget.category)?.amount ?? 0;
      const limit = toPesewas(budget.limit);
      const used = spent / limit;
      return {
        id: `bud_dev_${index + 1}`,
        category: categoryRef(budget.category),
        limit: budget.limit,
        spent: fromPesewas(spent),
        remaining: fromPesewas(Math.max(0, limit - spent)),
        used: fraction(used),
        projected: fromPesewas((spent / range.days) * range.fullDays),
        state: used >= 1 ? 'over' : used >= 0.8 ? 'warning' : 'on_track',
        alert_thresholds: ['0.8', '1.0'],
      };
    }),
  };
}

const handlers: { method: string; pattern: RegExp; handle: (match: string[], query: Query, body: unknown) => Promise<unknown> }[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/summary$/,
    handle: async (_, query): Promise<ApiSummary> => {
      const month = String(query.month ?? currentMonth());
      const { range, items } = await periodTransactions({ month });
      const prevMonth = previousMonth(month);
      const prev = await periodTransactions({ month: prevMonth });
      const out = items.filter((t) => t.direction === 'out');
      const moneyIn = total(items.filter((t) => t.direction === 'in'));
      const moneyOut = total(out);
      const prevOut = total(prev.items.filter((t) => t.direction === 'out'));
      const prevIn = total(prev.items.filter((t) => t.direction === 'in'));
      const top = spendingByCategory(items)[0];
      const { transactions } = await getDataset();
      return {
        period: { from: range.from, to: range.to, days: range.days },
        currency: 'GHS',
        money_out: fromPesewas(moneyOut),
        money_in: fromPesewas(moneyIn),
        net: fromPesewas(moneyIn - moneyOut),
        fees: fromPesewas(total(items, (t) => t.fee) + total(items, (t) => t.tax)),
        avg_daily_spend: fromPesewas(moneyOut / range.days),
        spending_transactions: out.length,
        compare: {
          period: { from: prev.range.from, to: prev.range.to },
          money_out: fromPesewas(prevOut),
          money_out_change: prevOut ? fraction((moneyOut - prevOut) / prevOut) : null,
          money_in_change: prevIn ? fraction((moneyIn - prevIn) / prevIn) : null,
        },
        top_category: top
          ? { id: top.id, name: categoryRef(top.id).name, share: fraction(top.amount / moneyOut) }
          : null,
        recurring_monthly_cost: recurringList(transactions).monthly_cost,
        includes_provisional: items.some((t) => t.status === 'provisional'),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/summary\/categories$/,
    handle: async (_, query): Promise<ApiCategorySummary> => {
      const month = String(query.month ?? currentMonth());
      const { range, items } = await periodTransactions({ month });
      const spending = spendingByCategory(items);
      const sum = spending.reduce((acc, s) => acc + s.amount, 0);
      const budget = await budgets(month);
      return {
        period: { from: range.from, to: range.to },
        total: fromPesewas(sum),
        items: spending.map((s) => {
          const b = budget.items.find((item) => item.category.id === s.id);
          return {
            category: categoryRef(s.id),
            amount: fromPesewas(s.amount),
            share: fraction(sum ? s.amount / sum : 0),
            transactions: s.list.length,
            budget: b ? { limit: b.limit, used: b.used } : null,
          };
        }),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/summary\/trend$/,
    handle: async (): Promise<ApiTrend> => {
      const { transactions } = await getDataset();
      const months = new Map<string, ApiTransaction[]>();
      for (const t of transactions.filter(counted)) {
        const month = t.occurred_at.slice(0, 7);
        months.set(month, [...(months.get(month) ?? []), t]);
      }
      return {
        granularity: 'month',
        items: [...months.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, list]) => ({
            period,
            money_out: fromPesewas(total(list.filter((t) => t.direction === 'out'))),
            money_in: fromPesewas(total(list.filter((t) => t.direction === 'in'))),
            fees: fromPesewas(total(list, (t) => t.fee)),
          })),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/balances$/,
    handle: async (): Promise<ApiBalances> => {
      const { wallets, transactions } = await getDataset();
      const items = wallets.flatMap((wallet) => {
        const latest = transactions.find((t) => t.wallet_id === wallet.id && t.balance_after !== null);
        return latest
          ? [{ wallet_id: wallet.id, provider: wallet.provider, balance: latest.balance_after!, as_of: latest.occurred_at }]
          : [];
      });
      return { total: fromPesewas(items.reduce((sum, item) => sum + toPesewas(item.balance), 0)), items };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/wallets$/,
    handle: async (): Promise<{ items: ApiWallet[] }> => {
      const { wallets, transactions } = await getDataset();
      return {
        items: wallets.map((wallet) => {
          const latest = transactions.find((t) => t.wallet_id === wallet.id);
          return {
            id: wallet.id,
            provider: wallet.provider,
            phone_number: wallet.phoneNumber,
            account_name: wallet.accountName,
            label: wallet.label,
            latest_balance: latest?.balance_after ?? null,
            balance_as_of: latest?.occurred_at ?? null,
            created_at: wallet.createdAt,
          };
        }),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/insights$/,
    handle: async (_, query): Promise<{ items: ApiInsight[] }> => {
      const month = String(query.month ?? currentMonth());
      const { items } = await periodTransactions({ month });
      const prev = await periodTransactions({ month: previousMonth(month) });
      const insights: ApiInsight[] = [];

      const fees = total(items, (t) => t.fee);
      const cashoutFees = total(items.filter((t) => t.type === 'cashout'), (t) => t.fee);
      if (fees > 0 && cashoutFees / fees > 0.4) {
        insights.push({
          id: 'fees_cashout',
          severity: 'warning',
          title: 'Cash-outs cost you the most',
          body: `${Math.round((cashoutFees / fees) * 100)}% of your fees come from cash-outs. Paying merchants directly avoids them.`,
          link: 'sikatrack://fees',
        });
      }

      const now = spendingByCategory(items);
      const before = spendingByCategory(prev.items);
      const rising = now
        .map((s) => ({ ...s, before: before.find((b) => b.id === s.id)?.amount ?? 0 }))
        .filter((s) => s.before > 0 && s.amount > s.before)
        .sort((a, b) => b.amount / b.before - a.amount / a.before)[0];
      if (rising) {
        const places = [...new Set(rising.list.map((t) => t.counterparty.name))].slice(0, 2);
        const prevName = MONTH_NAMES[Number(previousMonth(month).slice(5)) - 1];
        insights.push({
          id: `rising_${rising.id}`,
          severity: 'info',
          title: `${categoryRef(rising.id).name} is up ${Math.round((rising.amount / rising.before - 1) * 100)}% on ${prevName}`,
          body: `Most of it at ${places.join(' and ')}.`,
          link: `sikatrack://categories/${rising.id}`,
        });
      }

      const budget = (await budgets(month)).items
        .filter((b) => b.state === 'on_track')
        .sort((a, b) => Number(a.used) - Number(b.used))[0];
      if (budget) {
        const range = monthRange(month);
        insights.push({
          id: `budget_${budget.category.id}`,
          severity: 'tip',
          title: `${budget.category.name} is well under budget`,
          body: `GHS ${budget.remaining} left with ${range.fullDays - range.days} days to go.`,
          link: `sikatrack://budgets/${budget.category.id}`,
        });
      }
      return { items: insights };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/recurring$/,
    handle: async () => recurringList((await getDataset()).transactions),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/budgets$/,
    handle: async (_, query) => budgets(String(query.month ?? currentMonth())),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/categories$/,
    handle: async (): Promise<ApiCategories> => ({ items: CATEGORIES }),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/sync\/status$/,
    handle: async (): Promise<ApiSyncStatus> => {
      const { transactions } = await getDataset();
      const final = transactions.find((t) => t.status === 'final');
      return {
        latest_date_ms: transactions[0] ? String(Date.parse(transactions[0].occurred_at)) : null,
        last_upload_at: transactions[0]?.occurred_at ?? null,
        pending_messages: 0,
        provisional_transactions: transactions.filter((t) => t.status === 'provisional').length,
        last_pipeline_run: { status: 'succeeded', finished_at: new Date(Date.now() - 5 * 60000).toISOString() },
        data_through: final?.occurred_at ?? null,
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transactions$/,
    handle: async (_, query): Promise<ApiPage<ApiTransaction>> => {
      const { transactions } = await getDataset();
      const from = String(query.from ?? isoDate(Date.now() - 29 * DAY_MS));
      const to = String(query.to ?? isoDate(Date.now()));
      const categories = ([] as string[]).concat((query.category as string | string[] | undefined) ?? []);
      const q = typeof query.q === 'string' && query.q.trim().length >= 2 ? query.q.trim().toLowerCase() : null;
      const min = query.min_amount ? toPesewas(String(query.min_amount)) : null;
      const max = query.max_amount ? toPesewas(String(query.max_amount)) : null;
      const matching = transactions.filter(
        (t) =>
          inRange(t, from, to) &&
          (String(query.include_own_transfers) === 'true' || !t.is_own_transfer) &&
          (!query.direction || t.direction === query.direction) &&
          (!categories.length || categories.includes(t.category.id)) &&
          (!query.provider || t.provider === query.provider) &&
          (!query.wallet_id || t.wallet_id === query.wallet_id) &&
          (!query.counterparty_id || t.counterparty.id === query.counterparty_id) &&
          (!query.recurring_id || t.recurring_id === query.recurring_id) &&
          (min === null || toPesewas(t.amount) >= min) &&
          (max === null || toPesewas(t.amount) <= max) &&
          (!q ||
            t.counterparty.name.toLowerCase().includes(q) ||
            (t.reference ?? '').toLowerCase().includes(q)),
      );
      const limit = Math.min(Number(query.limit ?? 50), 100);
      const offset = Number(query.cursor ?? 0);
      const page = matching.slice(offset, offset + limit).map(({ sms_text, sms_count, category_explanation, provider_txn_id, ...item }) => item);
      return { items: page, next_cursor: offset + limit < matching.length ? String(offset + limit) : null };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/transactions\/([^/]+)$/,
    handle: async ([id]): Promise<ApiTransactionDetail> => {
      const { transactions } = await getDataset();
      return transactions.find((t) => t.id === id) ?? notFound();
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/transactions\/([^/]+)$/,
    handle: async ([id], _, body): Promise<ApiTransactionDetail> => {
      const { transactions } = await getDataset();
      const target = transactions.find((t) => t.id === id) ?? notFound();
      const patch = (body ?? {}) as ApiTransactionPatch;
      if (patch.note !== undefined) target.note = patch.note;
      if (patch.category !== undefined) {
        const category = patch.category ? categoryRef(patch.category) : target.category;
        target.category = category;
        target.category_source = patch.category ? 'user' : 'rule';
        if (patch.category === null) target.category_explanation = target.category_explanation ?? null;
        if (patch.category && patch.apply_to_counterparty) {
          for (const other of transactions) {
            if (other.counterparty.id === target.counterparty.id && other.id !== target.id && other.category_source !== 'user') {
              other.category = category;
              other.category_source = 'counterparty_default';
            }
          }
        }
      }
      return target;
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/notifications$/,
    handle: async (_, query): Promise<ApiNotifications> => {
      const all = await notifications();
      const items = String(query.unread_only) === 'true' ? all.filter((n) => !n.read_at) : all;
      return { unread: all.filter((n) => !n.read_at).length, items, next_cursor: null };
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/notifications\/read-all$/,
    handle: async () => {
      for (const n of await notifications()) n.read_at ??= new Date().toISOString();
      return undefined;
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/notifications\/([^/]+)\/read$/,
    handle: async ([id]) => {
      const target = (await notifications()).find((n) => n.id === id) ?? notFound();
      target.read_at ??= new Date().toISOString();
      return undefined;
    },
  },
];

let inbox: ApiNotifications['items'] | undefined;

/** A few notifications written from the sample data, the way the backend writes them. */
async function notifications() {
  if (inbox) return inbox;
  const { wallets, transactions } = await getDataset();
  const now = Date.now();
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const budget = (await budgets(currentMonth())).items;
  const items: ApiNotifications['items'] = [];
  const warning = budget.find((b) => b.state === 'warning');
  if (warning) {
    items.push({ id: 'ntf_dev_1', kind: 'budget_warning', title: `${warning.category.name} budget at ${Math.round(Number(warning.used) * 100)}%`, body: `GHS ${warning.spent} of GHS ${warning.limit} spent.`, created_at: ago(2 * 3600000), read_at: null, link: `sikatrack://budgets/${warning.category.id}` });
  }
  const over = budget.find((b) => b.state === 'over');
  if (over) {
    items.push({ id: 'ntf_dev_2', kind: 'budget_over', title: `${over.category.name} budget used up`, body: `You've spent GHS ${over.spent} of GHS ${over.limit}.`, created_at: ago(5 * DAY_MS), read_at: null, link: `sikatrack://budgets/${over.category.id}` });
  }
  for (const wallet of wallets) {
    const latest = transactions.find((t) => t.wallet_id === wallet.id);
    if (latest?.balance_after && toPesewas(latest.balance_after) < toPesewas(LOW_BALANCE_THRESHOLD)) {
      items.push({ id: `ntf_dev_low_${wallet.id}`, kind: 'low_balance', title: `${wallet.label ?? 'A wallet'} is below GHS ${LOW_BALANCE_THRESHOLD}`, body: `It has GHS ${latest.balance_after} left.`, created_at: latest.occurred_at, read_at: null, link: 'sikatrack://balances' });
    }
  }
  const series = RECURRING_SERIES[0];
  items.push({ id: 'ntf_dev_3', kind: 'new_recurring', title: 'New regular payment', body: series.label, created_at: ago(9 * DAY_MS), read_at: ago(8 * DAY_MS), link: `sikatrack://recurring/${series.id}` });
  items.push({ id: 'ntf_dev_4', kind: 'data_ready', title: 'Your latest payments are ready', body: `${Math.min(12, transactions.length)} new transactions.`, created_at: ago(12 * DAY_MS), read_at: ago(12 * DAY_MS), link: 'sikatrack://transactions' });
  inbox = items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return inbox;
}

/** Forgets read state, e.g. between tests. */
export function resetDevInbox() {
  inbox = undefined;
}

export async function handleDevRequest<T>(method: string, path: string, query: Query, body: unknown): Promise<T> {
  await wait(latency());
  if (process.env.EXPO_PUBLIC_DEV_API_FAILURE === 'true') {
    throw new ApiError({ status: 500, code: 'unexpected_error', title: 'Something went wrong' }, requestId());
  }
  for (const handler of handlers) {
    const match = handler.method === method ? path.match(handler.pattern) : null;
    if (match) {
      return (await handler.handle(match.slice(1), query, body)) as T;
    }
  }
  return notFound();
}
