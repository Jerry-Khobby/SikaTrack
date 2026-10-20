import { api } from '@/api/client';
import type { ApiCategorySummary, ApiSummary, ApiTrend } from '@/api/types';

import { toCategoryRef, type CategoryRef } from './categories';

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

/** `GET /v1/summary/categories?month=`: spending by category, largest first. */
export async function getCategorySpending(month: string): Promise<CategorySpending> {
  const s = await api.get<ApiCategorySummary>('/v1/summary/categories', { month });
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

/** The months that have any money in or out, newest first, from `GET /v1/summary/trend`. */
export async function listMonthsWithData(): Promise<string[]> {
  const trend = await api.get<ApiTrend>('/v1/summary/trend', { granularity: 'month' });
  return trend.items
    .filter((item) => Number(item.money_out) > 0 || Number(item.money_in) > 0)
    .map((item) => item.period)
    .sort((a, b) => b.localeCompare(a));
}
