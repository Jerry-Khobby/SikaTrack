/**
 * Every server read and write the screens make, as TanStack Query hooks. They
 * cache by key, refetch on pull-to-refresh, and refresh what an edit touched.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { getBalanceHistory, getBalances, listAccountWallets, type HistoryRange } from '@/services/balances';
import { deleteBudget, listBudgets, saveBudget, usualMonthlySpend, type BudgetInput } from '@/services/budgets';
import { listCategories } from '@/services/categories';
import { listInsights } from '@/services/insights';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications';
import {
  getRecurringOverview,
  getRecurringSeries,
  listRecurringPayments,
  updateRecurring,
  type RecurringDecision,
} from '@/services/recurring';
import {
  getCounterparty,
  listCounterparties,
  updateCounterparty,
  type CounterpartyChanges,
} from '@/services/counterparties';
import type { CounterpartyKind } from '@/services/categories';
import {
  getCategorySpending,
  getHabits,
  getMonthSummary,
  getTopCounterparties,
  getTrend,
  listMonthsWithData,
  type Granularity,
} from '@/services/summary';
import { getSyncStatus } from '@/services/sync';
import {
  getTransaction,
  listFeePayments,
  listRecentTransactions,
  listTransactions,
  updateTransaction,
  type TransactionChanges,
  type TransactionFilters,
} from '@/services/transactions';
import { addWallet, listWallets, removeWallet, updateWallet, type NewWallet, type WalletChanges } from '@/services/wallets';

export const queryKeys = {
  summary: (month: string) => ['summary', month] as const,
  categorySpending: (month: string, group = 'spending') => ['summary', 'categories', month, group] as const,
  trend: (granularity: string, from: string, to: string) => ['summary', 'trend', granularity, from, to] as const,
  habits: (month: string) => ['summary', 'habits', month] as const,
  topCounterparties: (month: string, direction: string) => ['summary', 'counterparties', month, direction] as const,
  counterparties: ['counterparties'] as const,
  counterpartyList: (q: string, kind: string | null) => ['counterparties', 'list', q, kind] as const,
  counterparty: (id: string) => ['counterparties', 'detail', id] as const,
  monthsWithData: ['summary', 'months'] as const,
  balances: ['balances'] as const,
  wallets: ['wallets'] as const,
  walletDetails: ['wallets', 'details'] as const,
  insights: (month: string) => ['insights', month] as const,
  recurring: ['recurring'] as const,
  recurringList: (status: string) => ['recurring', 'list', status] as const,
  recurringSeries: (id: string) => ['recurring', 'series', id] as const,
  recurringPayments: (id: string) => ['recurring', 'payments', id] as const,
  balanceHistory: (range: string) => ['balances', 'history', range] as const,
  usualSpend: (categoryId: string, month: string) => ['summary', 'usual', categoryId, month] as const,
  budgets: (month: string) => ['budgets', month] as const,
  categories: ['categories'] as const,
  syncStatus: ['sync-status'] as const,
  notifications: ['notifications'] as const,
  transactions: ['transactions'] as const,
  transactionList: (filters: TransactionFilters) => ['transactions', 'list', filters] as const,
  recentTransactions: ['transactions', 'recent'] as const,
  transactionPage: (filters: TransactionFilters, limit: number) => ['transactions', 'page', filters, limit] as const,
  feePayments: (from: string, to: string) => ['transactions', 'fees', from, to] as const,
  transaction: (id: string) => ['transactions', 'detail', id] as const,
};

export const useMonthSummary = (month: string) =>
  useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getMonthSummary(month) });

export const useCategorySpending = (month: string, group: 'spending' | 'money_in' = 'spending') =>
  useQuery({ queryKey: queryKeys.categorySpending(month, group), queryFn: () => getCategorySpending(month, group) });

/**
 * One category's total for each of several months (S18's six-month chart),
 * from the same per-month category summary Home and S17a use.
 */
export const useCategoryHistory = (categoryId: string, months: string[]) =>
  useQueries({
    queries: months.map((month) => ({
      queryKey: queryKeys.categorySpending(month, 'spending'),
      queryFn: () => getCategorySpending(month, 'spending'),
    })),
    combine: (results) => ({
      isPending: results.some((r) => r.isPending),
      amounts: results.map((r) => r.data?.items.find((item) => item.category.id === categoryId)?.amount ?? '0.00'),
    }),
  });

export const useTrend = (granularity: Granularity, range: { from: string; to: string }) =>
  useQuery({
    queryKey: queryKeys.trend(granularity, range.from, range.to),
    queryFn: () => getTrend(granularity, range),
    // Switching Daily/Weekly/Monthly keeps the last chart up while the next loads.
    placeholderData: (previous) => previous,
  });

export const useHabits = (month: string) =>
  useQuery({ queryKey: queryKeys.habits(month), queryFn: () => getHabits(month) });

export const useTopCounterparties = (month: string, direction: 'in' | 'out') =>
  useQuery({
    queryKey: queryKeys.topCounterparties(month, direction),
    queryFn: () => getTopCounterparties(month, direction),
  });

export const useCounterparties = (q: string, kind: CounterpartyKind | null) =>
  useQuery({
    queryKey: queryKeys.counterpartyList(q, kind),
    queryFn: () => listCounterparties({ q, kind }),
    placeholderData: (previous) => previous,
  });

export const useCounterparty = (id: string) =>
  useQuery({ queryKey: queryKeys.counterparty(id), queryFn: () => getCounterparty(id) });

export const useMonthsWithData = () =>
  useQuery({ queryKey: queryKeys.monthsWithData, queryFn: listMonthsWithData });

/** The wallets with their account names, for S26. */
export const useWalletDetails = () => useQuery({ queryKey: queryKeys.walletDetails, queryFn: listWallets });

export const useBalances = () => useQuery({ queryKey: queryKeys.balances, queryFn: getBalances });

export const useAccountWallets = () =>
  useQuery({ queryKey: queryKeys.wallets, queryFn: listAccountWallets });

export const useInsights = (month: string) =>
  useQuery({ queryKey: queryKeys.insights(month), queryFn: () => listInsights(month) });

export const useRecurringOverview = (status: 'active' | 'stopped' | 'all' = 'active') =>
  useQuery({ queryKey: queryKeys.recurringList(status), queryFn: () => getRecurringOverview(status) });

export const useRecurringSeries = (id: string) =>
  useQuery({ queryKey: queryKeys.recurringSeries(id), queryFn: () => getRecurringSeries(id) });

export const useRecurringPayments = (id: string) =>
  useQuery({ queryKey: queryKeys.recurringPayments(id), queryFn: () => listRecurringPayments(id) });

export const useBalanceHistory = (range: HistoryRange) =>
  useQuery({ queryKey: queryKeys.balanceHistory(range), queryFn: () => getBalanceHistory(range) });

export const useUsualSpend = (categoryId: string | null, month: string) =>
  useQuery({
    queryKey: queryKeys.usualSpend(categoryId ?? '', month),
    queryFn: () => usualMonthlySpend(categoryId!, month),
    enabled: Boolean(categoryId),
  });

export const useBudgets = (month: string) =>
  useQuery({ queryKey: queryKeys.budgets(month), queryFn: () => listBudgets(month) });

export const useCategories = () =>
  useQuery({ queryKey: queryKeys.categories, queryFn: listCategories, staleTime: Infinity });

export const useSyncStatus = () => useQuery({ queryKey: queryKeys.syncStatus, queryFn: getSyncStatus });

export const useNotifications = () =>
  useQuery({ queryKey: queryKeys.notifications, queryFn: listNotifications });

export const useRecentTransactions = () =>
  useQuery({ queryKey: queryKeys.recentTransactions, queryFn: () => listRecentTransactions() });

/** The transaction list, a page of 50 at a time. */
export const useTransactionList = (filters: TransactionFilters) =>
  useInfiniteQuery({
    queryKey: queryKeys.transactionList(filters),
    queryFn: ({ pageParam }) => listTransactions(filters, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });

/** The first `limit` payments matching the filters, for short lists like S18's and S20's. */
export const usePayments = (filters: TransactionFilters, limit = 20) =>
  useQuery({ queryKey: queryKeys.transactionPage(filters, limit), queryFn: () => listTransactions(filters, null, limit) });

export const useFeePayments = (range: { from: string; to: string }) =>
  useQuery({ queryKey: queryKeys.feePayments(range.from, range.to), queryFn: () => listFeePayments(range) });

export const useTransaction = (id: string) =>
  useQuery({ queryKey: queryKeys.transaction(id), queryFn: () => getTransaction(id) });

/** Saves a category or note, shows it at once, and refreshes every list and total it touches. */
export function useUpdateTransaction(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: TransactionChanges) => updateTransaction(id, changes),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.transaction(id), updated);
      client.invalidateQueries({ queryKey: queryKeys.transactions });
      client.invalidateQueries({ queryKey: ['summary'] });
      client.invalidateQueries({ queryKey: ['budgets'] });
      client.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications }),
  });
}

/** Saves a recurring decision or label, and refreshes the lists and Home's monthly cost. */
export function useUpdateRecurring(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: { userState?: RecurringDecision; label?: string }) => updateRecurring(id, changes),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.recurringSeries(id), updated);
      client.invalidateQueries({ queryKey: queryKeys.recurring });
      client.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/** Renames a counterparty or sets its default category; both show on every screen. */
export function useUpdateCounterparty(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: CounterpartyChanges) => updateCounterparty(id, changes),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.counterparty(id), updated);
      for (const key of [queryKeys.counterparties, queryKeys.transactions, ['summary'], ['budgets'], ['insights'], queryKeys.recurring]) {
        client.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/** Like useUpdateRecurring, for lists where each row is a different series (S28's "Review these"). */
export function useUpdateAnyRecurring() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: { userState?: RecurringDecision; label?: string } }) =>
      updateRecurring(id, changes),
    onSuccess: (updated) => {
      client.setQueryData(queryKeys.recurringSeries(updated.id), updated);
      client.invalidateQueries({ queryKey: queryKeys.recurring });
      client.invalidateQueries({ queryKey: ['summary'] });
    },
  });
}

/** Creates or replaces a budget, and refreshes every budget view. */
export function useSaveBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, input }: { categoryId: string; input: BudgetInput }) => saveBudget(categoryId, input),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['budgets'] });
      client.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

export function useDeleteBudget() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteBudget,
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['budgets'] });
      client.invalidateQueries({ queryKey: ['insights'] });
    },
  });
}

/** After a wallet changes: labels, balances, history and the transactions spread over them. */
function invalidateWallets(client: ReturnType<typeof useQueryClient>) {
  for (const key of [queryKeys.wallets, queryKeys.balances, queryKeys.transactions, ['summary'], ['budgets'], ['insights']]) {
    client.invalidateQueries({ queryKey: key });
  }
}

export function useAddWallet() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (input: NewWallet) => addWallet(input), onSuccess: () => invalidateWallets(client) });
}

export function useUpdateWallet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: WalletChanges }) => updateWallet(id, changes),
    onSuccess: () => invalidateWallets(client),
  });
}

export function useRemoveWallet() {
  const client = useQueryClient();
  return useMutation({ mutationFn: removeWallet, onSuccess: () => invalidateWallets(client) });
}
