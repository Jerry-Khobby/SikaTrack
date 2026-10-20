import { api } from '@/api/client';
import type { ApiInsight } from '@/api/types';

export type Insight = {
  id: string;
  severity: 'info' | 'tip' | 'warning';
  title: string;
  body: string;
  /** A `sikatrack://` deep link. */
  link: string | null;
};

/** `GET /v1/insights?month=`: ready-to-show cards, in the order to show them. */
export async function listInsights(month: string): Promise<Insight[]> {
  const response = await api.get<{ items: ApiInsight[] }>('/v1/insights', { month });
  return response.items;
}
