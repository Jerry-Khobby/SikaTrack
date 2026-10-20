import { api } from '@/api/client';
import type { ApiPage, ApiRecurringItem, ApiRecurringList, ApiTransaction } from '@/api/types';

import { toCategoryRef, toCounterparty, type CategoryRef, type Counterparty } from './categories';
import { toTransaction, type Transaction } from './transactions';

export type RecurringDecision = 'expected' | 'cancel_planned' | 'not_recurring';

export type RecurringSeries = {
  id: string;
  label: string;
  counterparty: Counterparty;
  category: CategoryRef;
  rhythm: string;
  intervalDays: number;
  typicalAmount: string;
  payments: number;
  firstPaidAt: string;
  lastPaidAt: string;
  status: 'active' | 'stopped';
  monthlyCost: string;
  /** null until the user has said whether it's really regular. */
  userState: RecurringDecision | null;
};

export type RecurringOverview = { monthlyCost: string; series: RecurringSeries[] };

const toSeries = (item: ApiRecurringItem): RecurringSeries => ({
  id: item.id,
  label: item.label,
  counterparty: toCounterparty(item.counterparty),
  category: toCategoryRef(item.category),
  rhythm: item.rhythm,
  intervalDays: item.interval_days,
  typicalAmount: item.typical_amount,
  payments: item.payments,
  firstPaidAt: item.first_paid_at,
  lastPaidAt: item.last_paid_at,
  status: item.status,
  monthlyCost: item.monthly_cost,
  userState: item.user_state,
});

/** `GET /v1/recurring?status=`: the series and what the active ones cost a month together. */
export async function getRecurringOverview(status: 'active' | 'stopped' | 'all' = 'active'): Promise<RecurringOverview> {
  const response = await api.get<ApiRecurringList>('/v1/recurring', { status });
  return { monthlyCost: response.monthly_cost, series: response.items.map(toSeries) };
}

/** `GET /v1/recurring/{id}` */
export async function getRecurringSeries(id: string) {
  return toSeries(await api.get<ApiRecurringItem>(`/v1/recurring/${id}`));
}

/** `GET /v1/recurring/{id}/transactions`: its payments, newest first. */
export async function listRecurringPayments(id: string, limit = 12): Promise<Transaction[]> {
  const page = await api.get<ApiPage<ApiTransaction>>(`/v1/recurring/${id}/transactions`, { limit });
  return page.items.map(toTransaction);
}

/** `PATCH /v1/recurring/{id}`: the user's decision, or a new label. */
export async function updateRecurring(id: string, changes: { userState?: RecurringDecision; label?: string }) {
  return toSeries(
    await api.patch<ApiRecurringItem>(`/v1/recurring/${id}`, {
      ...(changes.userState !== undefined && { user_state: changes.userState }),
      ...(changes.label !== undefined && { label: changes.label }),
    }),
  );
}

/**
 * "Still charging": the user means to cancel it, but the series is still
 * active. The API has no separate flag, so the app reads it from these two.
 */
export function isStillCharging(series: Pick<RecurringSeries, 'userState' | 'status'>) {
  return series.userState === 'cancel_planned' && series.status === 'active';
}

export const RHYTHM_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  fortnightly: 'Fortnightly',
  monthly: 'Monthly',
};
