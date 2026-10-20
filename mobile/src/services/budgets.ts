import { api } from '@/api/client';
import type { ApiBudgets } from '@/api/types';
import { previousMonth } from '@/utils/dates';
import { fromPesewas, toPesewas } from '@/utils/money';

import { toCategoryRef, type CategoryRef } from './categories';
import { getCategorySpending } from './summary';

export type Budget = {
  id: string;
  category: CategoryRef;
  limit: string;
  spent: string;
  remaining: string;
  /** Fraction of the limit used, e.g. `"0.875"`. */
  used: string;
  /** Spending at the month's pace so far, extended to its end. */
  projected: string;
  state: 'on_track' | 'warning' | 'over';
  /** Fractions that send an alert, e.g. `["0.8", "1.0"]`. */
  alertThresholds: string[];
};

export type BudgetInput = { limit: string; alertThresholds: string[] };

type ApiBudget = ApiBudgets['items'][number];

const toBudget = (item: ApiBudget): Budget => ({
  id: item.id,
  category: toCategoryRef(item.category),
  limit: item.limit,
  spent: item.spent,
  remaining: item.remaining,
  used: item.used,
  projected: item.projected,
  state: item.state,
  alertThresholds: item.alert_thresholds,
});

/** `GET /v1/budgets?month=` */
export async function listBudgets(month: string): Promise<Budget[]> {
  const response = await api.get<ApiBudgets>('/v1/budgets', { month });
  return response.items.map(toBudget);
}

/** `PUT /v1/budgets/{category_id}`: creates or replaces the category's budget. */
export async function saveBudget(categoryId: string, input: BudgetInput) {
  return toBudget(
    await api.put<ApiBudget>(`/v1/budgets/${categoryId}`, {
      limit: input.limit,
      alert_thresholds: input.alertThresholds,
    }),
  );
}

/** `DELETE /v1/budgets/{category_id}` */
export async function deleteBudget(categoryId: string) {
  await api.delete<void>(`/v1/budgets/${categoryId}`);
}

/** The budgets closest to their limit, for Home's strip. */
export function closestToLimit(budgets: Budget[], count = 2) {
  return [...budgets].sort((a, b) => Number(b.used) - Number(a.used)).slice(0, count);
}

/** The first alert threshold, where a budget turns "Close to limit" (0.8 by default). */
export function warningThreshold(budget: Pick<Budget, 'alertThresholds'>) {
  return Number(budget.alertThresholds[0] ?? '0.8');
}

/**
 * What the user usually spends on a category a month: the average of the last
 * three full months (`GET /v1/summary/categories`), or null with no history.
 */
export async function usualMonthlySpend(categoryId: string, month: string): Promise<string | null> {
  const months: string[] = [];
  for (let m = month; months.length < 3; ) {
    m = previousMonth(m);
    months.push(m);
  }
  const spending = await Promise.all(months.map((m) => getCategorySpending(m)));
  const amounts = spending
    .map((s) => s.items.find((item) => item.category.id === categoryId)?.amount)
    .filter((amount): amount is string => amount !== undefined);
  if (!amounts.length) return null;
  return fromPesewas(amounts.reduce((sum, a) => sum + toPesewas(a), 0) / amounts.length);
}
