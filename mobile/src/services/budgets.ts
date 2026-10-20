import { api } from '@/api/client';
import type { ApiBudgets } from '@/api/types';

import { toCategoryRef, type CategoryRef } from './categories';

export type Budget = {
  id: string;
  category: CategoryRef;
  limit: string;
  spent: string;
  remaining: string;
  /** Fraction of the limit used, e.g. `"0.875"`. */
  used: string;
  state: 'on_track' | 'warning' | 'over';
};

/** `GET /v1/budgets?month=` */
export async function listBudgets(month: string): Promise<Budget[]> {
  const response = await api.get<ApiBudgets>('/v1/budgets', { month });
  return response.items.map((item) => ({
    id: item.id,
    category: toCategoryRef(item.category),
    limit: item.limit,
    spent: item.spent,
    remaining: item.remaining,
    used: item.used,
    state: item.state,
  }));
}

/** The budgets closest to their limit, for Home's strip. */
export function closestToLimit(budgets: Budget[], count = 2) {
  return [...budgets].sort((a, b) => Number(b.used) - Number(a.used)).slice(0, count);
}
