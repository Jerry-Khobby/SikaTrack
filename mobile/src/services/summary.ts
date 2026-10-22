import { api } from '@/api/client';
import type { ApiCategorySummary, ApiCounterpartySummary, ApiHabits, ApiSummary, ApiTrend, DayPart } from '@/api/types';

import { allTimeRange } from '@/utils/dates';
import type { Granularity } from '@/utils/periods';

import { toCategoryRef, toCounterparty, type CategoryRef, type Counterparty } from './categories';

export type { DayPart };
export type { Granularity };

export type MonthSummary = {
  period: { from: string; to: string; days: number };
  currency: string;
  moneyOut: string;
  moneyIn: string;
  net: string;
  fees: string;
  avgDailySpend: string;
  spendingTransactions: number;
  compare: {
    month: string;
    moneyOut: string;
    /** Fraction string, e.g. `"-0.305"`; null when there's nothing to compare with. */
    moneyOutChange: string | null;
    moneyInChange: string | null;
  };
  topCategory: { id: string; name: string; share: string } | null;
  recurringMonthlyCost: string;
  includesProvisional: boolean;
};

export type CategorySpend = {
  category: CategoryRef;
  amount: string;
  share: string;
  transactions: number;
  budget: { limit: string; used: string } | null;
};

export type CategorySpending = { total: string; items: CategorySpend[] };

/** `GET /v1/summary?month=`: the Home hero. */
export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const s = await api.get<ApiSummary>('/v1/summary', { month });
  return {
    period: { from: s.period.from, to: s.period.to, days: s.period.days ?? 0 },
    currency: s.currency,
    moneyOut: s.money_out,
    moneyIn: s.money_in,
    net: s.net,
    fees: s.fees,
    avgDailySpend: s.avg_daily_spend,
    spendingTransactions: s.spending_transactions,
    compare: {
      month: s.compare.period.from.slice(0, 7),
      moneyOut: s.compare.money_out,
      moneyOutChange: s.compare.money_out_change,
      moneyInChange: s.compare.money_in_change,
    },
    topCategory: s.top_category,
    recurringMonthlyCost: s.recurring_monthly_cost,
    includesProvisional: s.includes_provisional,
  };
}

/**
 * `GET /v1/summary/categories?month=&group=`: spending (or money in) by
 * category, largest first.
 */
export async function getCategorySpending(month: string, group: 'spending' | 'money_in' = 'spending'): Promise<CategorySpending> {
  const s = await api.get<ApiCategorySummary>('/v1/summary/categories', { month, group });
  return {
    total: s.total,
    items: s.items.map((item) => ({
      category: toCategoryRef(item.category),
      amount: item.amount,
      share: item.share,
      transactions: item.transactions,
      budget: item.budget,
    })),
  };
}

/**
 * The months that have any money in or out, newest first, from `GET /v1/summary/trend`
 * over the longest range the API allows (with no range it answers for this month only).
 */
export async function listMonthsWithData(): Promise<string[]> {
  const range = allTimeRange();
  const trend = await api.get<ApiTrend>('/v1/summary/trend', { granularity: 'month', from: range.from, to: range.to });
  return trend.items
    .filter((item) => Number(item.money_out) > 0 || Number(item.money_in) > 0)
    .map((item) => item.period)
    .sort((a, b) => b.localeCompare(a));
}

export type TrendPoint = {
  /** `2026-10` for a month; the day (or a week's Monday) as `2026-10-12`. */
  period: string;
  moneyOut: string;
  moneyIn: string;
  /** Fees and tax together. */
  fees: string;
};

/** `GET /v1/summary/trend?granularity=&from=&to=`: one point per period, zeros included. */
export async function getTrend(granularity: Granularity, range: { from: string; to: string }): Promise<TrendPoint[]> {
  const trend = await api.get<ApiTrend>('/v1/summary/trend', { granularity, from: range.from, to: range.to });
  return trend.items.map((item) => ({
    period: item.period,
    moneyOut: item.money_out,
    moneyIn: item.money_in,
    fees: item.fees,
  }));
}

export type Habits = {
  /** `weekday` 1 (Monday) to 7 (Sunday). */
  grid: { weekday: number; dayPart: DayPart; amount: string }[];
  byHour: { hour: number; amount: string }[];
  peak: { weekday: number; dayPart: DayPart } | null;
  /** Fraction, e.g. `"0.280"`. */
  weekendShare: string;
  medianPayment: string;
};

/** `GET /v1/summary/habits?month=`: when in the week and day the money goes. */
export async function getHabits(month: string): Promise<Habits> {
  const h = await api.get<ApiHabits>('/v1/summary/habits', { month });
  return {
    grid: h.grid.map((cell) => ({ weekday: cell.weekday, dayPart: cell.day_part, amount: cell.amount })),
    byHour: h.by_hour,
    // The API always sends a peak, with both fields null when nothing was spent.
    peak:
      h.peak.weekday !== null && h.peak.day_part !== null ? { weekday: h.peak.weekday, dayPart: h.peak.day_part } : null,
    weekendShare: h.weekend_share ?? '0',
    medianPayment: h.median_payment ?? '0.00',
  };
}

export type CounterpartyTotal = { counterparty: Counterparty; amount: string; transactions: number };

/** `GET /v1/summary/counterparties?month=&direction=&limit=`: who got (or sent) the most. */
export async function getTopCounterparties(
  month: string,
  direction: 'in' | 'out',
  limit = 10,
): Promise<CounterpartyTotal[]> {
  const s = await api.get<ApiCounterpartySummary>('/v1/summary/counterparties', { month, direction, limit });
  return s.items.map((item) => ({
    counterparty: toCounterparty(item.counterparty),
    amount: item.amount,
    transactions: item.transactions,
  }));
}
