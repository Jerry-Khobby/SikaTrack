/**
 * Answers API requests inside the app while there's no backend, with the JSON
 * shapes from backend/docs/api-contract.md, worked out from the sample dataset.
 * Start with EXPO_PUBLIC_DEV_API_FAILURE to make every request fail (see devFailure).
 */
import { fromPesewas, toPesewas } from '@/utils/money';

import { ApiError } from '../errors';
import type {
  ApiBalanceHistory,
  ApiBalances,
  ApiBudgets,
  ApiCategories,
  ApiCategorySummary,
  ApiCounterparty,
  ApiCounterpartySummary,
  ApiHabits,
  ApiInsight,
  ApiMe,
  ApiMePatch,
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
  DayPart,
} from '../types';
import { BUDGETS, CATEGORIES, RECURRING_SERIES, categoryRef } from './catalog';
import {
  applyCounterpartyChoices,
  counterpartyChoice,
  originalName,
  resetCounterpartyStore,
  setCounterpartyChoice,
} from './counterparty-store';
import { getDataset as loadDataset } from './dataset';
import { lowBalanceThreshold, patchStoredMe, scheduleStoredDeletion, storedMe } from './me-store';
import {
  addStoredWallet,
  allWallets,
  removeStoredWallet,
  updateStoredWallet,
  type StoredWallet,
} from './wallet-store';

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

/** `GET /v1/me`: the stored account plus a summary of its data. */
async function meBody(): Promise<ApiMe> {
  const { deletionScheduledFor, ...me } = storedMe();
  const { transactions } = await getDataset();
  return {
    ...me,
    data: {
      first_transaction_at: transactions.at(-1)?.occurred_at ?? null,
      last_transaction_at: transactions[0]?.occurred_at ?? null,
      transactions: transactions.length,
    },
  };
}

/**
 * EXPO_PUBLIC_DEV_API_FAILURE makes every request fail, to see each global state:
 * `true` (an unexpected error), `unavailable` (503), `rate_limited` (429),
 * `session_expired` (refresh token gone) or `update_required` (426).
 */
function devFailure(): ApiError | null {
  switch (process.env.EXPO_PUBLIC_DEV_API_FAILURE) {
    case 'true':
      return new ApiError({ status: 500, code: 'unexpected_error', title: 'Something went wrong' }, requestId());
    case 'unavailable':
      return new ApiError({ status: 503, code: 'dependency_unavailable', title: 'Service unavailable' }, requestId());
    case 'rate_limited':
      return new ApiError({ status: 429, code: 'rate_limited', title: 'Too many requests' }, requestId(), 30);
    case 'session_expired':
      return new ApiError({ status: 401, code: 'refresh_invalid', title: 'Please sign in again' }, requestId());
    case 'update_required':
      return new ApiError({ status: 426, code: 'app_update_required', title: 'Update the app' }, requestId());
    default:
      return null;
  }
}

/** The dataset, with the user's aliases and default categories laid over it. */
async function getDataset() {
  const dataset = await loadDataset();
  applyCounterpartyChoices(dataset.transactions);
  return dataset;
}

const DAY_PARTS: DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

/** Morning 05–11, afternoon 12–16, evening 17–20, night 21–04. */
function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/** The period a day falls in: the day, its week's Monday, or its month. */
function periodKey(day: string, granularity: ApiTrend['granularity']) {
  if (granularity === 'month') return day.slice(0, 7);
  if (granularity === 'day') return day;
  const ms = Date.parse(day);
  return isoDate(ms - ((new Date(ms).getUTCDay() + 6) % 7) * DAY_MS);
}

/** Every period from `from` to `to`, oldest first, so empty ones still show. */
function periodsBetween(from: string, to: string, granularity: ApiTrend['granularity']) {
  const keys: string[] = [];
  for (let ms = Date.parse(from); ms <= Date.parse(to); ms += DAY_MS) {
    const key = periodKey(isoDate(ms), granularity);
    if (keys.at(-1) !== key) keys.push(key);
  }
  return keys;
}

/** Everyone the account has paid or been paid by, most money out first. */
function counterparties(transactions: ApiTransaction[]): ApiCounterparty[] {
  const byId = new Map<string, ApiTransaction[]>();
  for (const t of transactions.filter((t) => !t.is_own_transfer || t.counterparty.kind === 'own_wallet')) {
    byId.set(t.counterparty.id, [...(byId.get(t.counterparty.id) ?? []), t]);
  }
  return [...byId.values()]
    .map((list) => {
      const latest = list[0];
      const choice = counterpartyChoice(latest.counterparty.id);
      const out = list.filter((t) => t.direction === 'out');
      return {
        id: latest.counterparty.id,
        name: latest.counterparty.name,
        // The SMS writes names in capitals; the dataset keeps a tidied copy.
        original_name: originalName(latest).toUpperCase(),
        alias: choice.alias,
        kind: latest.counterparty.kind,
        default_category: choice.defaultCategory,
        money_out: fromPesewas(total(out)),
        transactions: list.length,
        last_seen_at: latest.occurred_at,
      };
    })
    .sort((a, b) => toPesewas(b.money_out) - toPesewas(a.money_out));
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

type RecurringItem = ApiRecurringList['items'][number];
type UserState = RecurringItem['user_state'];

/** The user's decisions and renames per series (`PATCH /v1/recurring/{id}`). */
let recurringChoices = new Map<string, { userState: UserState; label: string }>();

function recurringChoice(id: string) {
  if (!recurringChoices.has(id)) {
    const seed = RECURRING_SERIES.find((s) => s.id === id);
    recurringChoices.set(id, { userState: seed?.userState ?? null, label: seed?.label ?? '' });
  }
  return recurringChoices.get(id)!;
}

/** What a series costs a month at its rhythm, in pesewas. */
function monthlyPesewas(rhythm: string, amount: number) {
  if (rhythm === 'daily') return amount * 100 * 30;
  if (rhythm === 'weekly') return Math.round((amount * 100 * 52) / 12);
  return amount * 100;
}

/**
 * Every series the pipeline would find, with the user's decision. A series is
 * active while its last payment is within two rhythm-lengths of today.
 */
function recurringItems(transactions: ApiTransaction[]): RecurringItem[] {
  return RECURRING_SERIES.flatMap((series) => {
    const payments = transactions.filter((t) => t.recurring_id === series.id);
    if (!payments.length) return [];
    const choice = recurringChoice(series.id);
    const lastPaid = Date.parse(payments[0].occurred_at);
    return [{
      id: series.id,
      label: choice.label,
      counterparty: series.counterparty,
      category: categoryRef(series.category),
      rhythm: series.rhythm,
      interval_days: series.intervalDays,
      typical_amount: fromPesewas(series.amount * 100),
      payments: payments.length,
      first_paid_at: payments[payments.length - 1].occurred_at,
      last_paid_at: payments[0].occurred_at,
      status: Date.now() - lastPaid <= 2 * series.intervalDays * DAY_MS ? 'active' : 'stopped',
      monthly_cost: fromPesewas(monthlyPesewas(series.rhythm, series.amount)),
      user_state: choice.userState,
    }];
  });
}

/** `GET /v1/recurring`: false matches are hidden and left out of the monthly cost. */
function recurringList(transactions: ApiTransaction[], status = 'active'): ApiRecurringList {
  const shown = recurringItems(transactions).filter((item) => item.user_state !== 'not_recurring');
  const active = shown.filter((item) => item.status === 'active');
  return {
    monthly_cost: fromPesewas(active.reduce((sum, item) => sum + toPesewas(item.monthly_cost), 0)),
    items: status === 'all' ? shown : shown.filter((item) => item.status === status),
  };
}

/** The user's budgets (`PUT`/`DELETE /v1/budgets/{category_id}`). */
let budgetStore = BUDGETS.map((budget) => ({ ...budget, alert_thresholds: ['0.8', '1.0'] }));

/** Money in by category (`group=money_in`), or every category in and out (`all`). */
function byCategory(items: ApiTransaction[], group: 'money_in' | 'all') {
  const grouped = new Map<string, ApiTransaction[]>();
  for (const t of items.filter((t) => (group === 'all' ? true : t.direction === 'in' && t.category.group === 'money_in'))) {
    grouped.set(t.category.id, [...(grouped.get(t.category.id) ?? []), t]);
  }
  return [...grouped.entries()]
    .map(([id, list]) => ({ id, list, amount: total(list) }))
    .sort((a, b) => b.amount - a.amount);
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
    items: budgetStore.map((budget) => {
      const spent = spending.find((s) => s.id === budget.category)?.amount ?? 0;
      const limit = toPesewas(budget.limit);
      const used = spent / limit;
      const warnAt = Number(budget.alert_thresholds[0] ?? '0.8');
      return {
        id: `bud_dev_${budget.category}`,
        category: categoryRef(budget.category),
        limit: budget.limit,
        spent: fromPesewas(spent),
        remaining: fromPesewas(Math.max(0, limit - spent)),
        used: fraction(used),
        projected: fromPesewas((spent / range.days) * range.fullDays),
        state: used >= 1 ? 'over' : used >= warnAt ? 'warning' : 'on_track',
        alert_thresholds: budget.alert_thresholds,
      };
    }),
  };
}

const handlers: { method: string; pattern: RegExp; handle: (match: string[], query: Query, body: unknown) => Promise<unknown> }[] = [
  {
    method: 'GET',
    pattern: /^\/v1\/me$/,
    handle: async (): Promise<ApiMe> => meBody(),
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/me$/,
    handle: async (_, __, body): Promise<ApiMe> => {
      const patch = (body ?? {}) as ApiMePatch;
      const threshold = patch.settings?.low_balance_threshold;
      if (threshold !== undefined && !(/^\d+(\.\d{1,2})?$/.test(threshold) && toPesewas(threshold) > 0)) {
        throw new ApiError({ status: 400, code: 'validation_error', title: 'Enter an amount above zero' }, requestId());
      }
      patchStoredMe(patch);
      return meBody();
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/v1\/me$/,
    handle: async () => ({ deletion_scheduled_for: scheduleStoredDeletion() }),
  },
  {
    method: 'POST',
    pattern: /^\/v1\/auth\/logout$/,
    handle: async () => undefined,
  },
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
      const group = query.group === 'money_in' || query.group === 'all' ? query.group : 'spending';
      const spending = group === 'spending' ? spendingByCategory(items) : byCategory(items, group);
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
    handle: async (_, query): Promise<ApiTrend> => {
      const { transactions } = await getDataset();
      const granularity = (['day', 'week', 'month'].includes(String(query.granularity)) ? query.granularity : 'month') as ApiTrend['granularity'];
      const list = transactions.filter(counted);
      // With no range, everything the account has, from its first transaction to today.
      const range =
        typeof query.month === 'string'
          ? monthRange(query.month)
          : {
              from: String(query.from ?? list.at(-1)?.occurred_at.slice(0, 10) ?? isoDate(Date.now())),
              to: String(query.to ?? isoDate(Date.now())),
            };
      const byPeriod = new Map<string, ApiTransaction[]>();
      for (const t of list.filter((t) => inRange(t, range.from, range.to))) {
        const key = periodKey(t.occurred_at.slice(0, 10), granularity);
        byPeriod.set(key, [...(byPeriod.get(key) ?? []), t]);
      }
      return {
        granularity,
        // Periods with no transactions come back as zeros, so charts have no gaps.
        items: periodsBetween(range.from, range.to, granularity).map((period) => {
          const items = byPeriod.get(period) ?? [];
          return {
            period,
            money_out: fromPesewas(total(items.filter((t) => t.direction === 'out'))),
            money_in: fromPesewas(total(items.filter((t) => t.direction === 'in'))),
            fees: fromPesewas(total(items, (t) => t.fee) + total(items, (t) => t.tax)),
          };
        }),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/summary\/counterparties$/,
    handle: async (_, query): Promise<ApiCounterpartySummary> => {
      const { items } = await periodTransactions(query);
      const direction = query.direction === 'in' ? 'in' : 'out';
      const byCounterparty = new Map<string, ApiTransaction[]>();
      for (const t of items.filter((t) => t.direction === direction)) {
        byCounterparty.set(t.counterparty.id, [...(byCounterparty.get(t.counterparty.id) ?? []), t]);
      }
      return {
        items: [...byCounterparty.values()]
          .map((list) => ({ counterparty: list[0].counterparty, amount: total(list), transactions: list.length }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, Number(query.limit ?? 10))
          .map((item) => ({ ...item, amount: fromPesewas(item.amount) })),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/summary\/habits$/,
    handle: async (_, query): Promise<ApiHabits> => {
      const { items } = await periodTransactions(query);
      const spending = items.filter((t) => t.direction === 'out' && t.category.group === 'spending');
      const grid = new Map<string, number>();
      const byHour = Array.from({ length: 24 }, () => 0);
      let weekend = 0;
      for (const t of spending) {
        const at = new Date(t.occurred_at);
        const weekday = ((at.getUTCDay() + 6) % 7) + 1;
        const key = `${weekday}:${dayPart(at.getUTCHours())}`;
        const amount = toPesewas(t.amount);
        grid.set(key, (grid.get(key) ?? 0) + amount);
        byHour[at.getUTCHours()] += amount;
        if (weekday >= 6) weekend += amount;
      }
      const sum = total(spending);
      const peak = [...grid.entries()].sort((a, b) => b[1] - a[1])[0];
      const amounts = spending.map((t) => toPesewas(t.amount)).sort((a, b) => a - b);
      const mid = Math.floor(amounts.length / 2);
      const median = amounts.length ? (amounts.length % 2 ? amounts[mid] : Math.round((amounts[mid - 1] + amounts[mid]) / 2)) : 0;
      return {
        grid: [1, 2, 3, 4, 5, 6, 7].flatMap((weekday) =>
          DAY_PARTS.map((part) => ({ weekday, day_part: part, amount: fromPesewas(grid.get(`${weekday}:${part}`) ?? 0) })),
        ),
        by_hour: byHour.map((amount, hour) => ({ hour, amount: fromPesewas(amount) })),
        peak: peak ? { weekday: Number(peak[0].split(':')[0]), day_part: peak[0].split(':')[1] as DayPart } : null,
        weekend_share: fraction(sum ? weekend / sum : 0),
        median_payment: fromPesewas(median),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/counterparties$/,
    handle: async (_, query): Promise<ApiPage<ApiCounterparty>> => {
      const { transactions } = await getDataset();
      const q = typeof query.q === 'string' ? query.q.trim().toLowerCase() : '';
      // Your own wallets only show when asked for by kind.
      const all = counterparties(transactions).filter((c) =>
        query.kind ? c.kind === query.kind : c.kind !== 'own_wallet',
      );
      const matching = all.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.original_name.toLowerCase().includes(q),
      );
      const limit = Math.min(Number(query.limit ?? 50), 100);
      const offset = Number(query.cursor ?? 0);
      return {
        items: matching.slice(offset, offset + limit),
        next_cursor: offset + limit < matching.length ? String(offset + limit) : null,
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/counterparties\/([^/]+)$/,
    handle: async ([id]): Promise<ApiCounterparty> => {
      const { transactions } = await getDataset();
      return counterparties(transactions).find((c) => c.id === id) ?? notFound();
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/counterparties\/([^/]+)$/,
    handle: async ([id], _, body): Promise<ApiCounterparty> => {
      const { transactions } = await getDataset();
      if (!transactions.some((t) => t.counterparty.id === id)) notFound();
      const patch = (body ?? {}) as { alias?: string | null; default_category?: string | null };
      if (patch.default_category && !CATEGORIES.some((c) => c.id === patch.default_category && c.user_selectable)) {
        throw new ApiError({ status: 400, code: 'validation_error', title: 'Unknown category' }, requestId());
      }
      setCounterpartyChoice(id, {
        ...(patch.alias !== undefined && { alias: patch.alias?.trim() || null }),
        ...(patch.default_category !== undefined && { defaultCategory: patch.default_category }),
      });
      applyCounterpartyChoices(transactions);
      return counterparties(transactions).find((c) => c.id === id)!;
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
    pattern: /^\/v1\/balances\/history$/,
    handle: async (_, query): Promise<ApiBalanceHistory> => {
      const { wallets, transactions } = await getDataset();
      const from = String(query.from ?? isoDate(Date.now() - 29 * DAY_MS));
      const to = String(query.to ?? isoDate(Date.now()));
      const chosen = wallets.filter((w) => !query.wallet_id || w.id === query.wallet_id);
      const items: ApiBalanceHistory['items'] = [];
      for (const wallet of chosen) {
        // Oldest first, so each day ends on its last balance; days with no SMS carry the last one forward.
        const own = transactions.filter((t) => t.wallet_id === wallet.id && t.balance_after !== null).reverse();
        let index = 0;
        let balance: string | null = null;
        for (let day = Date.parse(from); isoDate(day) <= to; day += DAY_MS) {
          const date = isoDate(day);
          while (index < own.length && own[index].occurred_at.slice(0, 10) <= date) {
            balance = own[index].balance_after;
            index++;
          }
          if (balance !== null) items.push({ date, wallet_id: wallet.id, balance });
        }
      }
      const month = currentMonth();
      const threshold = toPesewas(lowBalanceThreshold());
      const lowDays = new Set(
        items.filter((i) => i.date.startsWith(month) && toPesewas(i.balance) < threshold).map((i) => i.date),
      );
      return { items, days_below_threshold: lowDays.size, threshold: lowBalanceThreshold() };
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/wallets$/,
    handle: async (): Promise<{ items: ApiWallet[] }> => {
      const { transactions } = await getDataset();
      return { items: allWallets().map((wallet) => toApiWallet(wallet, transactions)) };
    },
  },
  {
    method: 'POST',
    pattern: /^\/v1\/wallets$/,
    handle: async (_, __, body): Promise<ApiWallet> => {
      const wallet = await addStoredWallet(body as Parameters<typeof addStoredWallet>[0]);
      return toApiWallet(wallet, (await getDataset()).transactions);
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/wallets\/([^/]+)$/,
    handle: async ([id], _, body): Promise<ApiWallet> => {
      const wallet = updateStoredWallet(id, body as { label?: string | null; account_name?: string });
      return toApiWallet(wallet, (await getDataset()).transactions);
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/v1\/wallets\/([^/]+)$/,
    handle: async ([id]) => {
      removeStoredWallet(id);
      return undefined;
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
    handle: async (_, query) =>
      recurringList((await getDataset()).transactions, String(query.status ?? 'active')),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/recurring\/([^/]+)$/,
    handle: async ([id]) =>
      recurringItems((await getDataset()).transactions).find((item) => item.id === id) ?? notFound(),
  },
  {
    method: 'GET',
    pattern: /^\/v1\/recurring\/([^/]+)\/transactions$/,
    handle: async ([id], query): Promise<ApiPage<ApiTransaction>> => {
      const { transactions } = await getDataset();
      if (!RECURRING_SERIES.some((s) => s.id === id)) notFound();
      const payments = transactions.filter((t) => t.recurring_id === id);
      const limit = Math.min(Number(query.limit ?? 50), 100);
      const offset = Number(query.cursor ?? 0);
      return {
        items: payments.slice(offset, offset + limit).map(({ sms_text, sms_count, category_explanation, provider_txn_id, ...item }) => item),
        next_cursor: offset + limit < payments.length ? String(offset + limit) : null,
      };
    },
  },
  {
    method: 'PATCH',
    pattern: /^\/v1\/recurring\/([^/]+)$/,
    handle: async ([id], _, body) => {
      if (!RECURRING_SERIES.some((s) => s.id === id)) notFound();
      const patch = (body ?? {}) as { user_state?: UserState; label?: string };
      const choice = recurringChoice(id);
      if (patch.user_state !== undefined) choice.userState = patch.user_state;
      if (patch.label !== undefined) choice.label = patch.label;
      return recurringItems((await getDataset()).transactions).find((item) => item.id === id)!;
    },
  },
  {
    method: 'GET',
    pattern: /^\/v1\/budgets$/,
    handle: async (_, query) => budgets(String(query.month ?? currentMonth())),
  },
  {
    method: 'PUT',
    pattern: /^\/v1\/budgets\/([^/]+)$/,
    handle: async ([category], _, body) => {
      const known = CATEGORIES.find((c) => c.id === category && c.group === 'spending' && c.user_selectable);
      if (!known) {
        throw new ApiError({ status: 400, code: 'validation_error', title: 'Pick a spending category' }, requestId());
      }
      const patch = body as { limit: string; alert_thresholds?: string[] };
      const next = { category, limit: patch.limit, alert_thresholds: patch.alert_thresholds ?? ['0.8', '1.0'] };
      budgetStore = budgetStore.some((b) => b.category === category)
        ? budgetStore.map((b) => (b.category === category ? next : b))
        : [...budgetStore, next];
      return (await budgets(currentMonth())).items.find((b) => b.category.id === category);
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/v1\/budgets\/([^/]+)$/,
    handle: async ([category]) => {
      budgetStore = budgetStore.filter((b) => b.category !== category);
      return undefined;
    },
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
    if (latest?.balance_after && toPesewas(latest.balance_after) < toPesewas(lowBalanceThreshold())) {
      items.push({ id: `ntf_dev_low_${wallet.id}`, kind: 'low_balance', title: `${wallet.label ?? 'A wallet'} is below GHS ${lowBalanceThreshold()}`, body: `It has GHS ${latest.balance_after} left.`, created_at: latest.occurred_at, read_at: null, link: 'sikatrack://balances' });
    }
  }
  const series = RECURRING_SERIES[0];
  items.push({ id: 'ntf_dev_3', kind: 'new_recurring', title: 'New regular payment', body: series.label, created_at: ago(9 * DAY_MS), read_at: ago(8 * DAY_MS), link: `sikatrack://recurring/${series.id}` });
  items.push({ id: 'ntf_dev_4', kind: 'data_ready', title: 'Your latest payments are ready', body: `${Math.min(12, transactions.length)} new transactions.`, created_at: ago(12 * DAY_MS), read_at: ago(12 * DAY_MS), link: 'sikatrack://transactions' });
  inbox = items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return inbox;
}

/** Forgets read state, e.g. between tests. */
/** Forgets everything the user changed (read state, budgets, recurring decisions), e.g. between tests. */
export function resetDevState() {
  inbox = undefined;
  budgetStore = BUDGETS.map((budget) => ({ ...budget, alert_thresholds: ['0.8', '1.0'] }));
  recurringChoices = new Map();
  resetCounterpartyStore();
}

function toApiWallet(wallet: StoredWallet, transactions: ApiTransaction[]): ApiWallet {
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
}

export async function handleDevRequest<T>(method: string, path: string, query: Query, body: unknown): Promise<T> {
  // No timer at all when the latency is 0, so tests with fake timers aren't held up.
  const ms = latency();
  if (ms > 0) await wait(ms);
  const failure = devFailure();
  if (failure) throw failure;
  for (const handler of handlers) {
    const match = handler.method === method ? path.match(handler.pattern) : null;
    if (match) {
      return (await handler.handle(match.slice(1), query, body)) as T;
    }
  }
  return notFound();
}
