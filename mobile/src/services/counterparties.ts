import { api } from '@/api/client';
import type { ApiCounterparty, ApiPage } from '@/api/types';

import type { CounterpartyKind } from './categories';

export type CounterpartyDetail = {
  id: string;
  /** The alias when there is one, else the SMS name. */
  name: string;
  /** Exactly as the SMS writes it, e.g. `SUNSHINE LAUNDRY`. */
  originalName: string;
  alias: string | null;
  kind: CounterpartyKind;
  defaultCategory: string | null;
  moneyOut: string;
  transactions: number;
  lastSeenAt: string;
};

export type CounterpartyChanges = { alias?: string | null; defaultCategory?: string | null };

/** The kinds S21 filters by, in the order its chips show. */
export const COUNTERPARTY_KIND_FILTERS: { kind: CounterpartyKind; label: string }[] = [
  { kind: 'person', label: 'People' },
  { kind: 'merchant', label: 'Merchants' },
  { kind: 'agent', label: 'Agents' },
  { kind: 'telco', label: 'Telcos' },
  { kind: 'bank', label: 'Banks' },
];

export const COUNTERPARTY_KIND_LABELS: Record<CounterpartyKind, string> = {
  person: 'Person',
  merchant: 'Shop',
  agent: 'Agent',
  telco: 'Telco',
  bank: 'Bank',
  own_wallet: 'Your wallet',
  unknown: 'Other',
};

const toDetail = (c: ApiCounterparty): CounterpartyDetail => ({
  id: c.id,
  name: c.name,
  originalName: c.original_name,
  alias: c.alias,
  kind: c.kind,
  defaultCategory: c.default_category,
  moneyOut: c.money_out,
  transactions: c.transactions,
  lastSeenAt: c.last_seen_at,
});

/** `GET /v1/counterparties?q=&kind=`: everyone, most money out first. */
export async function listCounterparties(filters: { q: string; kind: CounterpartyKind | null }) {
  const page = await api.get<ApiPage<ApiCounterparty>>('/v1/counterparties', {
    q: filters.q.trim() || undefined,
    kind: filters.kind ?? undefined,
    limit: 100,
  });
  return page.items.map(toDetail);
}

/** `GET /v1/counterparties/{id}` */
export async function getCounterparty(id: string) {
  return toDetail(await api.get<ApiCounterparty>(`/v1/counterparties/${id}`));
}

/** `PATCH /v1/counterparties/{id}`: an alias shown everywhere, and a default category. */
export async function updateCounterparty(id: string, changes: CounterpartyChanges) {
  return toDetail(
    await api.patch<ApiCounterparty>(`/v1/counterparties/${id}`, {
      ...(changes.alias !== undefined && { alias: changes.alias }),
      ...(changes.defaultCategory !== undefined && { default_category: changes.defaultCategory }),
    }),
  );
}
