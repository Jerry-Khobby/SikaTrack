import { api } from '@/api/client';
import type { ApiCategories, ApiCategoryRef, ApiCounterpartyRef, CategoryGroup, CounterpartyKind } from '@/api/types';

export type { CategoryGroup, CounterpartyKind };

export type CategoryRef = { id: string; name: string; group: CategoryGroup };

export type Category = CategoryRef & { userSelectable: boolean };

export type Counterparty = { id: string; name: string; kind: CounterpartyKind };

export const toCategoryRef = (c: ApiCategoryRef): CategoryRef => ({ id: c.id, name: c.name, group: c.group });

export const toCounterparty = (c: ApiCounterpartyRef): Counterparty => ({ id: c.id, name: c.name, kind: c.kind });

/** `GET /v1/categories`: the list for pickers and icons. */
export async function listCategories(): Promise<Category[]> {
  const response = await api.get<ApiCategories>('/v1/categories');
  return response.items.map((c) => ({ ...toCategoryRef(c), userSelectable: c.user_selectable }));
}

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
  spending: 'Spending',
  money_in: 'Money in',
  own_money: 'Own money',
};
