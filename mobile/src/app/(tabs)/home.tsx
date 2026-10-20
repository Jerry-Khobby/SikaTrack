import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, ErrorState, NavigationRow, StatusStrip } from '@/components/molecules';
import {
  BalancesCard,
  BudgetsCard,
  CategoryBreakdownCard,
  HomeHeader,
  HomeSkeleton,
  InsightCarousel,
  MonthPickerSheet,
  RecentTransactionsCard,
  SpendingHero,
} from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useMe } from '@/hooks/use-me';
import { useProviderNames } from '@/hooks/use-provider-names';
import {
  useBalances,
  useBudgets,
  useCategorySpending,
  useInsights,
  useMonthSummary,
  useMonthsWithData,
  useNotifications,
  useRecentTransactions,
  useRecurringOverview,
  useSyncStatus,
} from '@/hooks/queries';
import { closestToLimit } from '@/services/budgets';
import { syncMessage } from '@/services/sync';
import { currentMonth, daysLeftInMonth, greeting } from '@/utils/dates';
import { routeForLink } from '@/utils/deep-links';
import { formatMoney, formatShortMonth } from '@/utils/format';

/** S12 · Home: where my money stands this month. */
export default function HomeScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const me = useMe();
  const providerNames = useProviderNames();

  const summary = useMonthSummary(month);
  const spending = useCategorySpending(month);
  const balances = useBalances();
  const insights = useInsights(month);
  const recurring = useRecurringOverview();
  const budgets = useBudgets(month);
  const recent = useRecentTransactions();
  const sync = useSyncStatus();
  const notifications = useNotifications();
  const months = useMonthsWithData();

  const queries = [summary, spending, balances, insights, recurring, budgets, recent, sync, notifications, months];
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all(queries.map((query) => query.refetch()));
    setRefreshing(false);
  };

  const name = me?.displayName;
  const header = (
    <HomeHeader
      greeting={name ? `${greeting()}, ${name}` : greeting()}
      monthLabel={formatShortMonth(month)}
      onPressMonth={() => setPickingMonth(true)}
      unread={notifications.data?.unread ?? 0}
      onPressBell={() => router.push('/notifications')}
    />
  );

  if (summary.isPending) {
    return (
      <TabScreenTemplate>
        <HomeSkeleton />
      </TabScreenTemplate>
    );
  }

  if (summary.isError) {
    return (
      <TabScreenTemplate header={header} refreshing={refreshing} onRefresh={refresh}>
        <View style={styles.page}>
          <ErrorState
            title="We couldn't load your dashboard"
            requestId={requestIdOf(summary.error)}
            onRetry={refresh}
          />
        </View>
      </TabScreenTemplate>
    );
  }

  const data = summary.data;
  const empty = data.spendingTransactions === 0;
  const syncText = sync.data ? syncMessage(sync.data) : null;
  const activeRecurring = recurring.data?.series.filter((s) => s.status === 'active') ?? [];
  const availableMonths = Array.from(new Set([currentMonth(), ...(months.data ?? [])]));

  return (
    <TabScreenTemplate header={header} refreshing={refreshing} onRefresh={refresh}>
      <View style={styles.page}>
        {me?.onboarding.smsPermission === 'denied' && (
          <StatusStrip
            icon="message"
            tone="warning"
            text="Turn on SMS access to see your transactions"
            onPress={() => router.push('/onboarding/sms')}
          />
        )}
        {syncText && <StatusStrip icon="sync" text={syncText} onPress={() => router.navigate('/more')} />}
        <SpendingHero summary={data} month={month} onPress={() => router.navigate('/spending')} />

        {empty ? (
          <EmptyState
            title="Nothing to show yet"
            message="Your payments appear here as soon as your MoMo SMS arrive. Pull down to check for new ones."
            actionLabel="Check sync status"
            onAction={() => router.navigate('/more')}
          />
        ) : (
          <>
            {balances.data && balances.data.wallets.length > 0 && (
              <BalancesCard
                balances={balances.data}
                providerNames={providerNames}
                onPress={() => router.navigate('/more')}
              />
            )}
            {spending.data && spending.data.items.length > 0 && (
              <CategoryBreakdownCard
                spending={spending.data}
                currency={data.currency}
                onPressCategory={() => router.navigate('/spending')}
                onSeeAll={() => router.navigate('/spending')}
              />
            )}
          </>
        )}
      </View>

      {!empty && (
        <>
          {insights.data && insights.data.length > 0 && (
            <View style={styles.carousel}>
              <InsightCarousel
                insights={insights.data}
                onOpen={(insight) => {
                  const route = routeForLink(insight.link);
                  if (route) router.navigate(route);
                }}
              />
            </View>
          )}
          <View style={[styles.page, styles.after]}>
            {recurring.data && activeRecurring.length > 0 && (
              <NavigationRow
                icon="repeat"
                title={`${formatMoney(recurring.data.monthlyCost, data.currency)} a month`}
                subtitle={`in recurring payments · ${activeRecurring.length} active`}
                onPress={() => router.navigate('/more')}
              />
            )}
            {budgets.data && (
              <BudgetsCard
                budgets={closestToLimit(budgets.data)}
                daysLeft={daysLeftInMonth()}
                currency={data.currency}
                onPress={() => router.navigate('/budgets')}
              />
            )}
            {recent.data && recent.data.length > 0 && (
              <RecentTransactionsCard
                transactions={recent.data}
                providerNames={providerNames}
                onPressTransaction={(id) => router.push(`/transactions/${id}`)}
                onSeeAll={() => router.navigate('/transactions')}
              />
            )}
          </View>
        </>
      )}

      {pickingMonth && (
        <MonthPickerSheet
          months={availableMonths}
          selected={month}
          onSelect={(next) => {
            setMonth(next);
            setPickingMonth(false);
          }}
          onClose={() => setPickingMonth(false)}
        />
      )}
    </TabScreenTemplate>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 12,
  },
  carousel: {
    marginTop: 12,
  },
  after: {
    paddingTop: 12,
  },
});
