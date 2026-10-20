import { api, type Query } from '@/api/client';
import type { ApiPage, ApiTransaction, ApiTransactionDetail, ApiTransactionPatch, TransactionType } from '@/api/types';
import { presetRange, type DatePreset } from '@/utils/dates';
import { toPesewas } from '@/utils/money';

import { toCategoryRef, toCounterparty, type CategoryRef, type Counterparty } from './categories';

export type { TransactionType };

export type Transaction = {
  id: string;
  /** `provisional` until the pipeline has checked it; lists show a "Processing" pill. */
  status: 'final' | 'provisional';
  occurredAt: string;
  provider: string;
  walletId: string | null;
  type: TransactionType;
  direction: 'in' | 'out';
  amount: string;
  fee: string;
  tax: string;
  totalCost: string;
  balanceAfter: string | null;
  currency: string;
  category: CategoryRef;
  categorySource: 'rule' | 'user' | 'counterparty_default';
  counterparty: Counterparty;
  reference: string | null;
  note: string | null;
  isOwnTransfer: boolean;
  recurringId: string | null;
  flags: ('balance_gap' | 'duplicate_sms_merged')[];
};

export type TransactionDetail = Transaction & {
  smsText: string;
  smsCount: number;
  categoryExplanation: string | null;
  providerTxnId: string | null;
};

export type TransactionPage = { items: Transaction[]; nextCursor: string | null };

export type TransactionFilters = {
  date: { preset: DatePreset } | { from: string; to: string };
  direction: 'in' | 'out' | null;
  categories: string[];
  walletId: string | null;
  minAmount: string | null;
  maxAmount: string | null;
  includeOwnTransfers: boolean;
  counterparty: { id: string; name: string } | null;
  /** Search text; sent once it has at least two letters. */
  q: string;
};

export const DEFAULT_FILTERS: TransactionFilters = {
  date: { preset: 'last_30_days' },
  direction: null,
  categories: [],
  walletId: null,
  minAmount: null,
  maxAmount: null,
  includeOwnTransfers: false,
  counterparty: null,
  q: '',
};

export const PAGE_SIZE = 50;

export function toTransaction(t: ApiTransaction): Transaction {
  return {
    id: t.id,
    status: t.status,
    occurredAt: t.occurred_at,
    provider: t.provider,
    walletId: t.wallet_id,
    type: t.type,
    direction: t.direction,
    amount: t.amount,
    fee: t.fee,
    tax: t.tax,
    totalCost: t.total_cost,
    balanceAfter: t.balance_after,
    currency: t.currency,
    category: toCategoryRef(t.category),
    categorySource: t.category_source,
    counterparty: toCounterparty(t.counterparty),
    reference: t.reference,
    note: t.note,
    isOwnTransfer: t.is_own_transfer,
    recurringId: t.recurring_id,
    flags: t.flags,
  };
}

function toTransactionDetail(t: ApiTransactionDetail): TransactionDetail {
  return {
    ...toTransaction(t),
    smsText: t.sms_text,
    smsCount: t.sms_count,
    categoryExplanation: t.category_explanation,
    providerTxnId: t.provider_txn_id,
  };
}

/** The filters as `GET /v1/transactions` query parameters. */
export function filtersToQuery(filters: TransactionFilters, now = Date.now()): Query {
  const range = 'preset' in filters.date ? presetRange(filters.date.preset, now) : filters.date;
  return {
    from: range.from,
    to: range.to,
    direction: filters.direction,
    category: filters.categories.length ? filters.categories : undefined,
    wallet_id: filters.walletId,
    counterparty_id: filters.counterparty?.id,
    min_amount: filters.minAmount,
    max_amount: filters.maxAmount,
    include_own_transfers: filters.includeOwnTransfers || undefined,
    q: filters.q.trim().length >= 2 ? filters.q.trim() : undefined,
  };
}

/** How many filters differ from the defaults, not counting the date or the search. */
export function countActiveFilters(filters: TransactionFilters) {
  return [
    filters.direction !== null,
    filters.categories.length > 0,
    filters.walletId !== null,
    filters.minAmount !== null || filters.maxAmount !== null,
    filters.includeOwnTransfers,
    filters.counterparty !== null,
  ].filter(Boolean).length;
}

/** True when anything narrows the list beyond the default date range. */
export function hasActiveFilters(filters: TransactionFilters) {
  const defaultDate = 'preset' in DEFAULT_FILTERS.date ? DEFAULT_FILTERS.date.preset : null;
  const onDefaultDate = 'preset' in filters.date && filters.date.preset === defaultDate;
  return countActiveFilters(filters) > 0 || filters.q.trim().length >= 2 || !onDefaultDate;
}

/** `GET /v1/transactions`, one page of 50, newest first. */
export async function listTransactions(
  filters: TransactionFilters,
  cursor?: string | null,
  limit = PAGE_SIZE,
): Promise<TransactionPage> {
  const page = await api.get<ApiPage<ApiTransaction>>('/v1/transactions', {
    ...filtersToQuery(filters),
    limit,
    cursor: cursor ?? undefined,
  });
  return { items: page.items.map(toTransaction), nextCursor: page.next_cursor };
}

/**
 * S17e's list: every payment in the range that cost a fee or tax, biggest
 * first. The API has no fee filter, so it reads every page of the range.
 */
export async function listFeePayments(range: { from: string; to: string }) {
  const filters: TransactionFilters = { ...DEFAULT_FILTERS, date: range, direction: 'out' };
  const items: Transaction[] = [];
  let cursor: string | null = null;
  do {
    const page: TransactionPage = await listTransactions(filters, cursor, 100);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  const cost = (t: Transaction) => toPesewas(t.fee) + toPesewas(t.tax);
  return items.filter((t) => cost(t) > 0).sort((a, b) => cost(b) - cost(a));
}

/** `GET /v1/transactions?limit=5`: Home's recent list. */
export async function listRecentTransactions(limit = 5) {
  const page = await api.get<ApiPage<ApiTransaction>>('/v1/transactions', { limit });
  return page.items.map(toTransaction);
}

/** `GET /v1/transactions/{id}` */
export async function getTransaction(id: string) {
  return toTransactionDetail(await api.get<ApiTransactionDetail>(`/v1/transactions/${id}`));
}

export type TransactionChanges = {
  /** A category id, or null to go back to the automatic one. */
  category?: string | null;
  note?: string | null;
  applyToCounterparty?: boolean;
};

/** `PATCH /v1/transactions/{id}`: correct the category or add a note. */
export async function updateTransaction(id: string, changes: TransactionChanges) {
  const body: ApiTransactionPatch = {
    ...(changes.category !== undefined && { category: changes.category }),
    ...(changes.note !== undefined && { note: changes.note }),
    ...(changes.applyToCounterparty !== undefined && { apply_to_counterparty: changes.applyToCounterparty }),
  };
  return toTransactionDetail(await api.patch<ApiTransactionDetail>(`/v1/transactions/${id}`, body));
}
