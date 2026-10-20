import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import {
  CategorySpendRow,
  CounterpartyRow,
  EmptyState,
  ErrorState,
  FeeRow,
  FigureTile,
  FilterChip,
  InsightCard,
  NavigationRow,
  ScreenTitle,
  SegmentedControl,
} from '@/components/molecules';
import {
  CategoryDonutCard,
  FeesCard,
  HabitsHeatmapCard,
  HourlyCard,
  MonthPickerSheet,
  TrendCard,
} from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useMe } from '@/hooks/use-me';
import {
  useCategorySpending,
  useFeePayments,
  useHabits,
  useInsights,
  useMonthsWithData,
  useTopCounterparties,
  useTrend,
} from '@/hooks/queries';
import { COUNTERPARTY_KIND_LABELS } from '@/services/counterparties';
import type { DayPart } from '@/services/summary';
import { DataColors } from '@/theme/colors';
import { formatTick } from '@/utils/chart-scale';
import { currentMonth, formatDayMonth, formatMonthName } from '@/utils/dates';
import { formatChange, formatMoney, formatMoneyWhole, formatShare, formatShortMonth } from '@/utils/format';
import { fromPesewas, sumMoney, toPesewas } from '@/utils/money';
import {
  isCurrentPeriod,
  periodAxisLabel,
  periodRange,
  periodTitle,
  trendRange,
  type Granularity,
} from '@/utils/periods';

type SpendingView = 'categories' | 'trend' | 'habits' | 'people' | 'fees';

const VIEWS: { id: SpendingView; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'trend', label: 'Trend' },
  { id: 'habits', label: 'Habits' },
  { id: 'people', label: 'People' },
  { id: 'fees', label: 'Fees' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** S17 · Spending: the analysis behind Home, one month at a time. */
export default function SpendingScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const client = useQueryClient();
  const me = useMe();
  const [view, setView] = useState<SpendingView>('categories');
  const [month, setMonth] = useState(currentMonth);
  const [pickingMonth, setPickingMonth] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const months = useMonthsWithData();
  const currency = me?.settings.currency ?? '';

  // `sikatrack://fees` opens this tab on Fees.
  useEffect(() => {
    if (params.view && VIEWS.some((v) => v.id === params.view)) setView(params.view as SpendingView);
  }, [params.view]);

  const refresh = async () => {
    setRefreshing(true);
    await client.refetchQueries({ type: 'active' });
    setRefreshing(false);
  };

  const header = (
    <View>
      <View className="flex-row items-center justify-between px-4 pt-[18px]">
        <ScreenTitle title="Spending" />
        <View className="mb-3">
          <FilterChip label={formatShortMonth(month)} chevron icon="calendar" onPress={() => setPickingMonth(true)} />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        contentContainerClassName="gap-1.5 px-4 pb-2.5 pt-1">
        {VIEWS.map((v) => (
          <FilterChip key={v.id} label={v.label} active={v.id === view} onPress={() => setView(v.id)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <TabScreenTemplate header={header} refreshing={refreshing} onRefresh={refresh}>
      <View className="gap-3 px-4 pt-1">
        {view === 'categories' && <CategoriesView month={month} currency={currency} />}
        {view === 'trend' && <TrendView month={month} currency={currency} />}
        {view === 'habits' && <HabitsView month={month} currency={currency} />}
        {view === 'people' && <PeopleView month={month} currency={currency} />}
        {view === 'fees' && <FeesView month={month} currency={currency} />}
      </View>
      {pickingMonth && (
        <MonthPickerSheet
          months={Array.from(new Set([currentMonth(), ...(months.data ?? [])]))}
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

type ViewProps = { month: string; currency: string };

function Loading() {
  return (
    <>
      <View className="h-[260px] rounded-[22px] bg-skeleton" />
      <View className="h-[180px] rounded-[22px] bg-skeleton" />
    </>
  );
}

/** S17a · Categories: the donut and every category with its amount, share and budget. */
function CategoriesView({ month, currency }: ViewProps) {
  const router = useRouter();
  const [group, setGroup] = useState<'spending' | 'money_in'>('spending');
  const spending = useCategorySpending(month, group);

  if (spending.isError) {
    return <ErrorState title="We couldn't load your categories" requestId={requestIdOf(spending.error)} onRetry={() => spending.refetch()} />;
  }
  if (spending.isPending) return <Loading />;

  const { items, total } = spending.data;
  const payments = items.reduce((n, item) => n + item.transactions, 0);
  const word = group === 'spending' ? 'spending' : 'money in';
  // The top five keep their colours; everything after shares the neutral one as Other.
  const colorOf = (index: number) => DataColors.categories[index] ?? DataColors.categoryOther;
  const top = items.slice(0, 5);
  const rest = items.slice(5);
  const other = sumMoney(rest.map((item) => item.amount));
  const slices = [
    ...top.map((item, index) => ({
      key: item.category.id,
      name: item.category.name,
      color: colorOf(index),
      value: toPesewas(item.amount),
      share: formatShare(item.share),
      amount: formatMoneyWhole(item.amount, currency),
    })),
    ...(rest.length
      ? [
          {
            key: 'other',
            name: `Other (${rest.length})`,
            color: DataColors.categoryOther,
            value: toPesewas(other),
            share: formatShare(String(rest.reduce((sum, item) => sum + Number(item.share), 0))),
            amount: formatMoneyWhole(other, currency),
          },
        ]
      : []),
  ];
  const largest = toPesewas(items[0]?.amount ?? '0');

  const toggle = (
    <SegmentedControl
      options={[
        { value: 'spending', label: 'Spending' },
        { value: 'money_in', label: 'Money in' },
      ]}
      value={group}
      onChange={setGroup}
      accessibilityLabel="Show"
    />
  );

  if (items.length === 0) {
    return (
      <>
        <Card radius={22}>{toggle}</Card>
        <EmptyState
          title={`No ${word} in ${formatMonthName(month)}`}
          message="Pick another month at the top, or pull down to check for new payments."
        />
      </>
    );
  }

  return (
    <>
      <CategoryDonutCard
        header={toggle}
        slices={slices}
        caption={formatMonthName(month)}
        total={formatMoneyWhole(total, currency)}
        footnote={plural(payments, 'payment')}
      />
      <Card padded={false} radius={22} className="overflow-hidden">
        {items.map((item, index) => (
          <CategorySpendRow
            key={item.category.id}
            categoryId={item.category.id}
            name={item.category.name}
            amount={formatMoney(item.amount, currency)}
            barFraction={largest ? toPesewas(item.amount) / largest : 0}
            color={colorOf(index)}
            detail={`${formatShare(item.share)} of ${word} · ${plural(item.transactions, 'payment')}`}
            budget={
              item.budget
                ? {
                    used: Number(item.budget.used),
                    label: `${formatMoneyWhole(item.amount, currency)} of ${formatMoneyWhole(item.budget.limit, currency)} budget`,
                  }
                : undefined
            }
            onPress={() => router.push({ pathname: '/categories/[id]', params: { id: item.category.id, month } })}
            divider={index < items.length - 1}
          />
        ))}
      </Card>
    </>
  );
}

/** S17b · Trend: money out and in per day, week or month, every figure readable. */
function TrendView({ month, currency }: ViewProps) {
  const router = useRouter();
  const [granularity, setGranularity] = useState<Granularity>('month');
  const range = useMemo(() => trendRange(granularity, month), [granularity, month]);
  const trend = useTrend(granularity, range);
  const points = useMemo(() => trend.data ?? [], [trend.data]);
  const [selected, setSelected] = useState(0);

  // A new chart starts on its latest period.
  useEffect(() => setSelected(Math.max(0, points.length - 1)), [points.length, granularity, month]);

  if (trend.isError) {
    return <ErrorState title="We couldn't load your trend" requestId={requestIdOf(trend.error)} onRetry={() => trend.refetch()} />;
  }
  if (trend.isPending) return <Loading />;

  const unitWord = { day: 'day', week: 'week', month: 'month' }[granularity];
  const point = points[Math.min(selected, points.length - 1)];
  const title = (period: string) =>
    `${periodTitle(period, granularity)}${isCurrentPeriod(period, granularity) ? ' (so far)' : ''}`;
  // Best and average leave out the period still going, so a half month doesn't look like a good one.
  const complete = points.filter((p) => !isCurrentPeriod(p.period, granularity) && toPesewas(p.moneyOut) > 0);
  const best = complete.reduce<(typeof points)[number] | null>(
    (low, p) => (!low || toPesewas(p.moneyOut) < toPesewas(low.moneyOut) ? p : low),
    null,
  );
  const average = complete.length
    ? fromPesewas(complete.reduce((sum, p) => sum + toPesewas(p.moneyOut), 0) / complete.length)
    : null;
  const labels = points.map((p) => {
    const label = periodAxisLabel(p.period, granularity);
    // Days: every fifth, so the numbers don't run into each other.
    if (granularity === 'day') return label === '1' || Number(label) % 5 === 0 ? label : '';
    if (granularity === 'week') return points.length > 6 && points.indexOf(p) % 2 === 1 ? '' : label;
    return label;
  });

  return (
    <>
      <TrendCard
        granularity={granularity}
        onGranularityChange={setGranularity}
        unit={currency}
        labels={labels}
        moneyOut={points.map((p) => Number(p.moneyOut))}
        moneyIn={points.map((p) => Number(p.moneyIn))}
        selected={selected}
        onSelect={setSelected}
        groupLabel={(i) =>
          `${title(points[i].period)}: out ${formatMoney(points[i].moneyOut, currency)}, in ${formatMoney(points[i].moneyIn, currency)}`
        }
        readout={
          point
            ? {
                title: title(point.period),
                moneyOut: formatMoney(point.moneyOut, currency),
                moneyIn: `+${formatMoney(point.moneyIn, currency)}`,
                fees: formatMoney(point.fees, currency),
              }
            : { title: '', moneyOut: '', moneyIn: '', fees: '' }
        }
        onSeeTransactions={() => {
          if (!point) return;
          const { from, to } = periodRange(point.period, granularity);
          router.navigate({ pathname: '/transactions', params: { from, to } });
        }}
      />
      <View className="flex-row gap-2.5">
        <FigureTile
          label={`Lowest ${unitWord}`}
          value={best ? periodTitle(best.period, granularity) : '—'}
          caption={best ? `${formatMoneyWhole(best.moneyOut, currency)} out` : `No full ${unitWord} yet`}
        />
        <FigureTile
          label="Average"
          value={average ? formatMoneyWhole(average, currency) : '—'}
          caption={`out a ${unitWord}`}
        />
      </View>
    </>
  );
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_PARTS: { id: DayPart; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'night', label: 'Night' },
];
const hour = (h: number) => `${String(h).padStart(2, '0')}:00`;

/** S17c · Habits: when in the week and the day the money goes. */
function HabitsView({ month, currency }: ViewProps) {
  const habits = useHabits(month);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  if (habits.isError) {
    return <ErrorState title="We couldn't load your habits" requestId={requestIdOf(habits.error)} onRetry={() => habits.refetch()} />;
  }
  if (habits.isPending) return <Loading />;

  const h = habits.data;
  if (!h.peak) {
    return <EmptyState title={`No spending in ${formatMonthName(month)}`} message="Your habits show once you've made some payments." />;
  }
  const amounts = WEEKDAYS.map((_, w) =>
    DAY_PARTS.map((part) => Number(h.grid.find((c) => c.weekday === w + 1 && c.dayPart === part.id)?.amount ?? 0)),
  );
  const highest = Math.max(...amounts.flat());
  const hours = h.byHour.map((b) => Number(b.amount));
  const busiest = hours.indexOf(Math.max(...hours));
  const shownHour = selectedHour ?? busiest;
  const peakPart = DAY_PARTS.find((p) => p.id === h.peak!.dayPart)!.label.toLowerCase();

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
        <FigureTile ink width={160} label="Peak" value={`You spend most on ${WEEKDAYS_LONG[h.peak.weekday - 1]} ${peakPart}s`} />
        <FigureTile width={130} label="Weekends" value={formatShare(h.weekendShare)} caption="of spending" />
        <FigureTile width={150} label="Typical payment" value={formatMoneyWhole(h.medianPayment, currency)} caption="the middle amount" />
      </ScrollView>
      <HabitsHeatmapCard
        weekdays={WEEKDAYS}
        dayParts={DAY_PARTS.map((p) => p.label)}
        amounts={amounts}
        lowLabel={`${currency} 0`}
        highLabel={`${currency} ${formatTick(Math.round(highest))}`}
        cellLabel={(w, p) =>
          `${WEEKDAYS_LONG[w]} ${DAY_PARTS[p].label.toLowerCase()}: ${formatMoney(String(amounts[w][p]), currency)}`
        }
      />
      <HourlyCard
        unit={currency}
        amounts={hours}
        selected={shownHour}
        onSelect={setSelectedHour}
        hourLabel={(i) => `${hour(i)} to ${hour((i + 1) % 24)}: ${formatMoney(h.byHour[i].amount, currency)}`}
        readout={`${hour(shownHour)}–${hour((shownHour + 1) % 24)} · ${formatMoney(h.byHour[shownHour].amount, currency)}${
          shownHour === busiest ? ' · your busiest hour' : ''
        }`}
      />
    </>
  );
}

/** S17d · People and places: the ten you paid (or who paid you) the most. */
function PeopleView({ month, currency }: ViewProps) {
  const router = useRouter();
  const [direction, setDirection] = useState<'out' | 'in'>('out');
  const top = useTopCounterparties(month, direction);
  const moneyIn = direction === 'in';

  const toggle = (
    <SegmentedControl
      options={[
        { value: 'out', label: 'Who I paid' },
        { value: 'in', label: 'Who paid me' },
      ]}
      value={direction}
      onChange={setDirection}
      accessibilityLabel="Show"
    />
  );

  let body;
  if (top.isError) {
    body = <ErrorState title="We couldn't load who you paid" requestId={requestIdOf(top.error)} onRetry={() => top.refetch()} />;
  } else if (top.isPending) {
    body = <View className="h-[320px] rounded-[22px] bg-skeleton" />;
  } else if (top.data.length === 0) {
    body = (
      <EmptyState
        title={moneyIn ? `Nobody paid you in ${formatMonthName(month)}` : `No payments in ${formatMonthName(month)}`}
        message="Pick another month at the top."
      />
    );
  } else {
    const largest = toPesewas(top.data[0].amount);
    body = (
      <Card padded={false} radius={22} className="overflow-hidden">
        {top.data.map((item, index) => (
          <CounterpartyRow
            key={item.counterparty.id}
            kind={item.counterparty.kind}
            name={item.counterparty.name}
            amount={`${moneyIn ? '+' : ''}${formatMoney(item.amount, currency)}`}
            moneyIn={moneyIn}
            detail={`${COUNTERPARTY_KIND_LABELS[item.counterparty.kind]} · ${plural(item.transactions, 'payment')}`}
            barFraction={largest ? toPesewas(item.amount) / largest : 0}
            barColor={moneyIn ? DataColors.moneyIn : DataColors.moneyOut}
            onPress={() => router.push(`/counterparties/${item.counterparty.id}`)}
            divider={index < top.data.length - 1}
          />
        ))}
      </Card>
    );
  }

  return (
    <>
      {toggle}
      {body}
      <NavigationRow icon="user" title="See everyone" subtitle="Search all the people and places you've paid" onPress={() => router.push('/counterparties')} />
    </>
  );
}

/** S17e · Fees: what the month cost in fees and tax, and which payments did it. */
function FeesView({ month, currency }: ViewProps) {
  const router = useRouter();
  const range = useMemo(() => trendRange('month', month), [month]);
  const trend = useTrend('month', range);
  const monthDays = useMemo(() => periodRange(month, 'month'), [month]);
  const payments = useFeePayments(monthDays);
  const insights = useInsights(month);

  if (trend.isError) {
    return <ErrorState title="We couldn't load your fees" requestId={requestIdOf(trend.error)} onRetry={() => trend.refetch()} />;
  }
  if (trend.isPending) return <Loading />;

  const points = trend.data;
  const current = points.length - 1;
  const fees = points[current]?.fees ?? '0.00';
  const previous = points[current - 1];
  const change =
    previous && toPesewas(previous.fees) > 0
      ? formatChange(String((toPesewas(fees) - toPesewas(previous.fees)) / toPesewas(previous.fees)))
      : null;
  const feeInsight = insights.data?.find((insight) => insight.link === 'sikatrack://fees');
  const costOf = (fee: string, tax: string) => fromPesewas(toPesewas(fee) + toPesewas(tax));

  return (
    <>
      <FeesCard
        total={formatMoney(fees, currency)}
        change={change && previous ? { text: `${change.text} vs ${formatMonthName(previous.period)}`, down: change.down } : undefined}
        unit={currency}
        labels={points.map((p) => periodAxisLabel(p.period, 'month'))}
        amounts={points.map((p) => Number(p.fees))}
        capLabels={points.map((p) => formatMoney(p.fees, '').trim())}
        current={current}
        monthLabel={(i) => `${periodTitle(points[i].period, 'month')}: ${formatMoney(points[i].fees, currency)} in fees and tax`}
      />
      {feeInsight && <InsightCard severity={feeInsight.severity} title={feeInsight.title} body={feeInsight.body} />}
      <ThemedText type="none" accessibilityRole="header" className="ml-1 mt-2 font-sans-extrabold text-[16px] leading-[22px]">
        Payments with a fee
      </ThemedText>
      {payments.isPending ? (
        <View className="h-[200px] rounded-[20px] bg-skeleton" />
      ) : payments.data && payments.data.length > 0 ? (
        <Card padded={false} className="overflow-hidden">
          {payments.data.map((t, index) => (
            <FeeRow
              key={t.id}
              categoryId={t.category.id}
              kind={t.counterparty.kind}
              name={t.counterparty.name}
              detail={`${t.category.name} · ${formatDayMonth(t.occurredAt)} · ${formatMoney(t.amount, currency)}`}
              fee={formatMoney(costOf(t.fee, t.tax), currency)}
              onPress={() => router.push(`/transactions/${t.id}`)}
              divider={index < payments.data.length - 1}
            />
          ))}
        </Card>
      ) : (
        <EmptyState title="No fees this month" message="None of this month's payments cost a fee or tax." />
      )}
    </>
  );
}
