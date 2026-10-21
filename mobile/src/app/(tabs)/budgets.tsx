import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Chip, ThemedText } from '@/components/atoms';
import {
  BudgetCard,
  EmptyState,
  ErrorState,
  FilterChip,
  FloatingButton,
  ScreenTitle,
  SwipeToDelete,
} from '@/components/molecules';
import {
  BudgetEditorSheet,
  BudgetSummaryCard,
  ConfirmDialog,
  MonthPickerSheet,
  type BudgetEditorValues,
} from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useMe } from '@/hooks/use-me';
import {
  useBudgets,
  useCategories,
  useCategorySpending,
  useDeleteBudget,
  useMonthsWithData,
  useSaveBudget,
  useUsualSpend,
} from '@/hooks/queries';
import { warningThreshold, type Budget } from '@/services/budgets';
import { currentMonth, daysLeftInMonth, formatMonthName } from '@/utils/dates';
import { formatMoney, formatMoneyWhole, formatShortMonth } from '@/utils/format';
import { fromPesewas, sumMoney, toPesewas } from '@/utils/money';

type EditorState = { mode: 'add'; categoryId: string | null } | { mode: 'edit'; budget: Budget };

/** S23 · Budgets: a monthly limit per category and how close each one is. */
export default function BudgetsScreen() {
  // `sikatrack://budgets/<category>` (a budget alert) picks that budget out.
  const { highlight } = useLocalSearchParams<{ highlight?: string }>();
  const me = useMe();
  const [month, setMonth] = useState(currentMonth);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorCategory, setEditorCategory] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Budget | null>(null);

  const budgets = useBudgets(month);
  const categories = useCategories();
  const spending = useCategorySpending(month);
  const months = useMonthsWithData();
  const usual = useUsualSpend(editorCategory, month);
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const currency = me?.settings.currency ?? '';
  const isCurrentMonth = month === currentMonth();
  const availableMonths = Array.from(new Set([currentMonth(), ...(months.data ?? [])]));

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([budgets.refetch(), spending.refetch(), months.refetch()]);
    setRefreshing(false);
  };

  const openEditor = (state: EditorState) => {
    setEditor(state);
    setEditorCategory(state.mode === 'edit' ? state.budget.category.id : state.categoryId);
  };

  const save = async ({ categoryId, limit, alertThresholds }: BudgetEditorValues) => {
    try {
      // The API takes money as a two-decimal string, so `350` goes as `350.00`.
      await saveBudget.mutateAsync({ categoryId, input: { limit: fromPesewas(toPesewas(limit)), alertThresholds } });
    } catch {
      throw new Error("We couldn't save this budget. Try again.");
    }
    setEditor(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await deleteBudget.mutateAsync(deleting.category.id);
    setDeleting(null);
    setEditor(null);
  };

  const header = (
    <View className="flex-row items-center justify-between px-4 pt-[18px]">
      <ScreenTitle title="Budgets" />
      <View className="mb-3">
        <FilterChip label={formatShortMonth(month)} chevron icon="calendar" onPress={() => setPickingMonth(true)} />
      </View>
    </View>
  );

  const spendingCategories = (categories.data ?? []).filter((c) => c.group === 'spending' && c.userSelectable);
  const list = budgets.data ?? [];
  const topSpending = (spending.data?.items ?? [])
    .filter((item) => spendingCategories.some((c) => c.id === item.category.id))
    .slice(0, 2);

  let body;
  if (budgets.isError) {
    body = <ErrorState title="We couldn't load your budgets" requestId={requestIdOf(budgets.error)} onRetry={refresh} />;
  } else if (budgets.isPending) {
    body = (
      <View className="gap-3">
        <View className="h-[150px] rounded-[22px] bg-skeleton" />
        <View className="h-[130px] rounded-[20px] bg-skeleton" />
        <View className="h-[130px] rounded-[20px] bg-skeleton" />
      </View>
    );
  } else if (list.length === 0) {
    body = (
      <View>
        <EmptyState
          icon="target"
          title="Budgets keep you on track"
          message="Set a monthly limit for a category and we'll tell you before you go over it."
          actionLabel="Create a budget"
          onAction={() => openEditor({ mode: 'add', categoryId: null })}
        />
        {topSpending.length > 0 && (
          <View className="mt-4 items-center">
            <ThemedText type="caption" themeColor="textSecondary" className="mb-2">
              Your biggest categories this month
            </ThemedText>
            <View className="flex-row gap-2">
              {topSpending.map((item) => (
                <Chip
                  key={item.category.id}
                  label={`${item.category.name} · ${formatMoneyWhole(item.amount, currency)}`}
                  onPress={() => openEditor({ mode: 'add', categoryId: item.category.id })}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  } else {
    const spent = sumMoney(list.map((b) => b.spent));
    const budgeted = sumMoney(list.map((b) => b.limit));
    const days = daysLeftInMonth();
    body = (
      <View className="gap-3">
        <BudgetSummaryCard
          spent={formatMoney(spent, currency)}
          budgeted={formatMoney(budgeted, currency)}
          used={toPesewas(budgeted) > 0 ? toPesewas(spent) / toPesewas(budgeted) : 0}
          footnote={
            isCurrentMonth
              ? `${days} day${days === 1 ? '' : 's'} left in ${formatMonthName(month)}`
              : `${formatMonthName(month)} is over`
          }
        />
        {list.map((budget) => {
          const left = toPesewas(budget.limit) - toPesewas(budget.spent);
          const projectedOver = toPesewas(budget.projected) > toPesewas(budget.limit);
          return (
            <SwipeToDelete
              key={budget.id}
              deleteLabel={`Delete ${budget.category.name} budget`}
              onDelete={() => setDeleting(budget)}>
              <BudgetCard
                categoryId={budget.category.id}
                name={budget.category.name}
                state={budget.state}
                used={Number(budget.used)}
                warnAt={warningThreshold(budget)}
                spent={formatMoney(budget.spent, currency)}
                limit={formatMoney(budget.limit, currency)}
                remainder={
                  left >= 0
                    ? `${formatMoney(fromPesewas(left), currency)} left`
                    : `${formatMoney(fromPesewas(-left), currency)} over`
                }
                projection={
                  isCurrentMonth ? `At this pace: ${formatMoneyWhole(budget.projected, currency)} by month end` : undefined
                }
                projectionOver={projectedOver}
                highlighted={budget.category.id === highlight}
                onPress={() => openEditor({ mode: 'edit', budget })}
              />
            </SwipeToDelete>
          );
        })}
        <ThemedText type="fine" themeColor="textSecondary" className="text-center">
          Swipe a budget left to delete it.
        </ThemedText>
      </View>
    );
  }

  return (
    <TabScreenTemplate
      header={header}
      refreshing={refreshing}
      onRefresh={refresh}
      floating={
        list.length > 0 ? (
          <FloatingButton icon="plus" label="New budget" onPress={() => openEditor({ mode: 'add', categoryId: null })} />
        ) : undefined
      }>
      <View className="px-4 pt-1">{body}</View>

      {editor && (
        <BudgetEditorSheet
          mode={editor.mode}
          categories={spendingCategories}
          budgeted={list.map((b) => b.category.id)}
          initial={
            editor.mode === 'edit'
              ? {
                  categoryId: editor.budget.category.id,
                  limit: editor.budget.limit,
                  alertThresholds: editor.budget.alertThresholds,
                }
              : { categoryId: editor.categoryId, limit: '', alertThresholds: ['0.8', '1.0'] }
          }
          currency={currency}
          usualSpend={(id) =>
            id === editorCategory && usual.data ? formatMoneyWhole(usual.data, currency) : null
          }
          onCategoryChange={setEditorCategory}
          onSave={save}
          onDelete={editor.mode === 'edit' ? () => setDeleting(editor.budget) : undefined}
          onClose={() => setEditor(null)}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={`Delete the ${deleting.category.name} budget?`}
          message="Your spending stays. You just won't get alerts for this category."
          confirmLabel="Delete"
          destructive
          busy={deleteBudget.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
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
