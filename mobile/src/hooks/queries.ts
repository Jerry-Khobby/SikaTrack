/**
 * Every server read and write the screens make, as TanStack Query hooks. They
 * cache by key, refetch on pull-to-refresh, and refresh what an edit touched.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { getBalances, listAccountWallets } from '@/services/balances';
import { listBudgets } from '@/services/budgets';
import { listCategories } from '@/services/categories';
import { listInsights } from '@/services/insights';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/notifications';
import { getRecurringOverview } from '@/services/recurring';
import { getCategorySpending, getMonthSummary, listMonthsWithData } from '@/services/summary';
import { getSyncStatus } from '@/services/sync';
import {
  getTransaction,
  listRecentTransactions,
  listTransactions,
  updateTransaction,
  type TransactionChanges,
  type TransactionFilters,
} from '@/services/transactions';

export const queryKeys = {
  summary: (month: string) => ['summary', month] as const,
  categorySpending: (month: string) => ['summary', 'categories', month] as const,
  monthsWithData: ['summary', 'months'] as const,
  balances: ['balances'] as const,
  wallets: ['wallets'] as const,
  insights: (month: string) => ['insights', month] as const,
  recurring: ['recurring'] as const,
  budgets: (month: string) => ['budgets', month] as const,
  categories: ['categories'] as const,
  syncStatus: ['sync-status'] as const,
  notifications: ['notifications'] as const,
  transactions: ['transactions'] as const,
  transactionList: (filters: TransactionFilters) => ['transactions', 'list', filters] as const,
  recentTransactions: ['transactions', 'recent'] as const,
  transaction: (id: string) => ['transactions', 'detail', id] as const,
};

export const useMonthSummary = (month: string) =>
  useQuery({ queryKey: queryKeys.summary(month), queryFn: () => getMonthSummary(month) });

export const useCategorySpending = (month: string) =>
  useQuery({ queryKey: queryKeys.categorySpending(month), queryFn: () => getCategorySpending(month) });

export const useMonthsWithData = () =>
  useQuery({ queryKey: queryKeys.monthsWithData, queryFn: listMonthsWithData });

export const useBalances = () => useQuery({ queryKey: queryKeys.balances, queryFn: getBalances });

export const useAccountWallets = () =>
  useQuery({ queryKey: queryKeys.wallets, queryFn: listAccountWallets });

export const useInsights = (month: string) =>
  useQuery({ queryKey: queryKeys.insights(month), queryFn: () => listInsights(month) });

export const useRecurringOverview = () =>
  useQuery({ queryKey: queryKeys.recurring, queryFn: getRecurringOverview });

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
