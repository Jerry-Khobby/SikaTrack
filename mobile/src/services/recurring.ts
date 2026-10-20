import { api } from '@/api/client';
import type { ApiRecurringList } from '@/api/types';

export type RecurringSeries = {
  id: string;
  label: string;
  monthlyCost: string;
  status: 'active' | 'stopped';
};

export type RecurringOverview = { monthlyCost: string; series: RecurringSeries[] };

/** `GET /v1/recurring`: active series and what they cost a month together. */
export async function getRecurringOverview(): Promise<RecurringOverview> {
  const response = await api.get<ApiRecurringList>('/v1/recurring');
  return {
    monthlyCost: response.monthly_cost,
    series: response.items.map((item) => ({
      id: item.id,
      label: item.label,
      monthlyCost: item.monthly_cost,
      status: item.status,
    })),
  };
}
