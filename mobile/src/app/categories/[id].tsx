import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { BarChart, Button, Card, CategoryGlyph, Pill, ProgressBar, ThemedText, type PillTone } from '@/components/atoms';
import { CounterpartyRow, ErrorState, SectionHeader, TransactionRow } from '@/components/molecules';
import { BudgetEditorSheet, ConfirmDialog, type BudgetEditorValues } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useProviderNames } from '@/hooks/use-provider-names';
import { useTheme } from '@/hooks/use-theme';
import { useDataColors } from '@/hooks/use-data-colors';
import {
  useBudgets,
  useCategories,
  useCategoryHistory,
  useCategorySpending,
  useDeleteBudget,
  usePayments,
  useSaveBudget,
  useUsualSpend,
} from '@/hooks/queries';
import type { CounterpartyKind } from '@/services/categories';
import { DEFAULT_FILTERS, type TransactionFilters } from '@/services/transactions';
import { currentMonth, formatDateTime, formatMonthName, previousMonth } from '@/utils/dates';
import { formatMoney, formatMoneyWhole, formatShare } from '@/utils/format';
import { fromPesewas, toPesewas } from '@/utils/money';
import { periodAxisLabel, periodRange, periodTitle } from '@/utils/periods';

const STATES: Record<'on_track' | 'warning' | 'over', { label: string; tone: PillTone }> = {
  on_track: { label: 'On track', tone: 'green' },
  warning: { label: 'Close to limit', tone: 'amber' },
  over: { label: 'Over', tone: 'red' },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** S18 · One category: its month, six months of it, its budget, top places and payments. */
export default function CategoryDetailScreen() {
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const id = params.id;
  const month = params.month ?? currentMonth();
  const router = useRouter();
  const goBack = useGoBack('/spending');
  const theme = useTheme();
  const dataColors = useDataColors();
  const me = useMe();
  const providerNames = useProviderNames();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const months = useMemo(() => {
    const list = [month];
    while (list.length < 6) list.unshift(previousMonth(list[0]));
    return list;
  }, [month]);
  const range = useMemo(() => periodRange(month, 'month'), [month]);
  const filters = useMemo<TransactionFilters>(
    () => ({ ...DEFAULT_FILTERS, date: range, direction: 'out', categories: [id] }),
    [range, id],
  );

  const categories = useCategories();
  const spending = useCategorySpending(month);
  const history = useCategoryHistory(id, months);
  const budgets = useBudgets(month);
  const payments = usePayments(filters, 100);
  const usual = useUsualSpend(editing ? id : null, month);
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const currency = me?.settings.currency ?? '';
  const category = categories.data?.find((c) => c.id === id);
  const item = spending.data?.items.find((i) => i.category.id === id);
  const budget = budgets.data?.find((b) => b.category.id === id);
  const name = category?.name ?? item?.category.name ?? '';

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([spending.refetch(), budgets.refetch(), payments.refetch()]);
    setRefreshing(false);
  };

  const topPlaces = useMemo(() => {
    const byCounterparty = new Map<string, { id: string; name: string; kind: CounterpartyKind; amount: number; count: number }>();
    for (const t of payments.data?.items ?? []) {
      const entry = byCounterparty.get(t.counterparty.id) ?? { ...t.counterparty, amount: 0, count: 0 };
      entry.amount += toPesewas(t.amount);
      entry.count += 1;
      byCounterparty.set(t.counterparty.id, entry);
    }
    return [...byCounterparty.values()].sort((a, b) => b.amount - a.amount).slice(0, 3);
  }, [payments.data]);

  if (spending.isError || categories.isError) {
    return (
      <DetailTemplate onBack={goBack} gutter="narrow">
        <ErrorState title="We couldn't load this category" requestId={requestIdOf(spending.error ?? categories.error)} onRetry={refresh} />
      </DetailTemplate>
    );
  }

  const amount = item?.amount ?? '0.00';
  const save = async ({ categoryId, limit, alertThresholds }: BudgetEditorValues) => {
    try {
      await saveBudget.mutateAsync({ categoryId, input: { limit: fromPesewas(toPesewas(limit)), alertThresholds } });
    } catch {
      throw new Error("We couldn't save this budget. Try again.");
    }
    setEditing(false);
  };

  const recent = (payments.data?.items ?? []).slice(0, 10);

  return (
    <DetailTemplate onBack={goBack} gutter="narrow" refreshing={refreshing} onRefresh={refresh}>
      <View className="flex-row items-center gap-[14px] px-1 pb-1">
        <View className="h-14 w-14 items-center justify-center rounded-[28px] bg-avatar">
          <CategoryGlyph categoryId={id} color={theme.text} size={26} />
        </View>
        <View className="min-w-0 flex-1">
          <ThemedText type="none" accessibilityRole="header" className="font-sans-extrabold text-[22px] leading-[28px]">
            {name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            <ThemedText type="none" className="font-sans-bold text-[13px]">
              {formatMoney(amount, currency)}
            </ThemedText>{' '}
            in {formatMonthName(month)}
            {item ? ` · ${formatShare(item.share)} of spending` : ''}
          </ThemedText>
        </View>
      </View>

      <Card radius={22}>
        <SectionHeader title="Last 6 months" />
        {history.isPending ? (
          <View className="h-[150px] rounded-sm bg-skeleton" />
        ) : (
          <BarChart
            labels={months.map((m) => periodAxisLabel(m, 'month'))}
            unit={currency}
            height={140}
            series={[{ key: name, color: dataColors.moneyOut, values: history.amounts.map(Number) }]}
            capLabels={history.amounts.map((a) => formatMoneyWhole(a, '').trim())}
            emphasis={months.length - 1}
            groupLabel={(i) => `${periodTitle(months[i], 'month')}: ${formatMoney(history.amounts[i], currency)}`}
            accessibilityLabel={`${name} spending over the last six months`}
          />
        )}
      </Card>

      <Card radius={20}>
        {budget ? (
          <>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <ThemedText type="none" className="font-sans-extrabold text-[15px]">
                  Budget
                </ThemedText>
                <Pill label={STATES[budget.state].label} tone={STATES[budget.state].tone} />
              </View>
              <Button variant="link" label="Edit" onPress={() => setEditing(true)} />
            </View>
            <View className="mt-2">
              <ProgressBar
                progress={Number(budget.used)}
                accessibilityLabel={`${Math.round(Number(budget.used) * 100)}% of the budget used`}
                color={budget.state === 'over' ? theme.statusBad : budget.state === 'warning' ? theme.statusWarning : theme.statusGood}
              />
            </View>
            <ThemedText type="caption" themeColor="textSecondary" className="mt-2">
              {formatMoney(budget.spent, currency)} of {formatMoney(budget.limit, currency)} ·{' '}
              <ThemedText type="none" themeColor="none" className={`font-sans-bold text-[13px] ${budget.state === 'over' ? 'text-icon-red' : 'text-content'}`}>
                {toPesewas(budget.limit) >= toPesewas(budget.spent)
                  ? `${formatMoney(fromPesewas(toPesewas(budget.limit) - toPesewas(budget.spent)), currency)} left`
                  : `${formatMoney(fromPesewas(toPesewas(budget.spent) - toPesewas(budget.limit)), currency)} over`}
              </ThemedText>
            </ThemedText>
          </>
        ) : (
          <Button variant="secondary" label={`Set a budget for ${name}`} onPress={() => setEditing(true)} />
        )}
      </Card>

      {topPlaces.length > 0 && (
        <View>
          <SectionHeader title="Top places" />
          <Card padded={false} className="overflow-hidden">
            {topPlaces.map((place, index) => (
              <CounterpartyRow
                key={place.id}
                kind={place.kind}
                name={place.name}
                amount={formatMoney(fromPesewas(place.amount), currency)}
                detail={plural(place.count, 'payment')}
                onPress={() => router.push(`/counterparties/${place.id}`)}
                divider={index < topPlaces.length - 1}
              />
            ))}
          </Card>
        </View>
      )}

      <View>
        <SectionHeader
          title={`${formatMonthName(month)} payments`}
          actionLabel={(payments.data?.items.length ?? 0) > recent.length ? 'See all' : undefined}
          onAction={() => router.navigate({ pathname: '/transactions', params: { ...range, category: id } })}
        />
        {payments.isPending ? (
          <View className="h-[160px] rounded-[20px] bg-skeleton" />
        ) : recent.length ? (
          <Card padded={false} className="overflow-hidden">
            {recent.map((t, index) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                providerName={providerNames[t.provider] ?? t.provider}
                timeLabel={formatDateTime(t.occurredAt)}
                onPress={() => router.push(`/transactions/${t.id}`)}
                divider={index < recent.length - 1}
              />
            ))}
          </Card>
        ) : (
          <ThemedText type="caption" themeColor="textSecondary" className="ml-1">
            No {name} payments in {formatMonthName(month)}.
          </ThemedText>
        )}
      </View>

      {editing && category && (
        <BudgetEditorSheet
          mode={budget ? 'edit' : 'add'}
          categories={[category]}
          budgeted={budget ? [id] : []}
          initial={{
            categoryId: id,
            limit: budget?.limit ?? '',
            alertThresholds: budget?.alertThresholds ?? ['0.8', '1.0'],
          }}
          currency={currency}
          usualSpend={() => (usual.data ? formatMoneyWhole(usual.data, currency) : null)}
          onSave={save}
          onDelete={budget ? () => setDeleting(true) : undefined}
          onClose={() => setEditing(false)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${name} budget?`}
          message="Your spending stays. You just won't get alerts for this category."
          confirmLabel="Delete"
          destructive
          busy={deleteBudget.isPending}
          onConfirm={async () => {
            await deleteBudget.mutateAsync(id);
            setDeleting(false);
            setEditing(false);
          }}
          onCancel={() => setDeleting(false)}
        />
      )}
    </DetailTemplate>
  );
}
