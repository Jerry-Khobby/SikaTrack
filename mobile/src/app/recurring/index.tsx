import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card } from '@/components/atoms';
import { EmptyState, ErrorState, RecurringRow, SegmentedControl } from '@/components/molecules';
import { RecurringHero, RecurringReviewCard } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useRecurringOverview, useUpdateAnyRecurring } from '@/hooks/queries';
import { RHYTHM_LABELS, isStillCharging, type RecurringSeries } from '@/services/recurring';
import { formatDayMonth } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

type Tab = 'active' | 'stopped' | 'all';

const TABS: { value: Tab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'stopped', label: 'Stopped' },
  { value: 'all', label: 'All' },
];

const EMPTY: Record<Tab, { title: string; message: string }> = {
  active: {
    title: 'No regular payments yet',
    message: 'When you pay the same person or service on a rhythm, it shows up here.',
  },
  stopped: { title: 'Nothing has stopped', message: 'Payments that stop arriving on their rhythm move here.' },
  all: {
    title: 'No regular payments yet',
    message: 'When you pay the same person or service on a rhythm, it shows up here.',
  },
};

/** S28 · Recurring: subscriptions and regular payments found in the SMS. */
export default function RecurringScreen() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  const me = useMe();
  const [tab, setTab] = useState<Tab>('active');
  const [refreshing, setRefreshing] = useState(false);
  // One list with every series; the tabs filter it on the phone.
  const overview = useRecurringOverview('all');
  const decide = useUpdateAnyRecurring();

  const currency = me?.settings.currency ?? '';
  const refresh = async () => {
    setRefreshing(true);
    await overview.refetch();
    setRefreshing(false);
  };

  if (overview.isError) {
    return (
      <DetailTemplate title="Recurring" onBack={goBack} gutter="narrow">
        <ErrorState title="We couldn't load your recurring payments" requestId={requestIdOf(overview.error)} onRetry={refresh} />
      </DetailTemplate>
    );
  }

  if (overview.isPending) {
    return (
      <DetailTemplate title="Recurring" onBack={goBack} gutter="narrow">
        <View className="h-[120px] rounded-[22px] bg-skeleton" />
        <View className="h-[260px] rounded-[20px] bg-skeleton" />
      </DetailTemplate>
    );
  }

  const all = overview.data.series;
  const active = all.filter((s) => s.status === 'active');
  const toReview = all.filter((s) => s.userState === null);
  const shown = tab === 'all' ? all : all.filter((s) => s.status === tab);
  const rhythmOf = (s: RecurringSeries) => RHYTHM_LABELS[s.rhythm] ?? s.rhythm;

  return (
    <DetailTemplate title="Recurring" onBack={goBack} gutter="narrow" refreshing={refreshing} onRefresh={refresh}>
      <RecurringHero monthly={formatMoney(overview.data.monthlyCost, currency)} active={active.length} />

      {toReview.length > 0 && (
        <RecurringReviewCard
          items={toReview.map((s) => ({
            id: s.id,
            categoryId: s.category.id,
            kind: s.counterparty.kind,
            name: s.counterparty.name,
            detail: `${formatMoney(s.typicalAmount, currency)} · ${rhythmOf(s).toLowerCase()} · ${s.payments} payments`,
          }))}
          onExpected={(id) => decide.mutate({ id, changes: { userState: 'expected' } })}
          onNotRecurring={(id) => decide.mutate({ id, changes: { userState: 'not_recurring' } })}
        />
      )}

      <SegmentedControl options={TABS} value={tab} onChange={setTab} accessibilityLabel="Show" />

      {shown.length === 0 ? (
        <EmptyState icon="repeat" title={EMPTY[tab].title} message={EMPTY[tab].message} />
      ) : (
        <Card padded={false}>
          {shown.map((s, index) => (
            <RecurringRow
              key={s.id}
              categoryId={s.category.id}
              kind={s.counterparty.kind}
              name={s.counterparty.name}
              label={s.label}
              monthly={formatMoney(s.monthlyCost, currency)}
              rhythm={rhythmOf(s)}
              detail={`${formatMoney(s.typicalAmount, currency)} · last paid ${formatDayMonth(s.lastPaidAt)}`}
              stopped={s.status === 'stopped'}
              cancelPlanned={s.userState === 'cancel_planned' && s.status === 'stopped'}
              stillCharging={isStillCharging(s)}
              onPress={() => router.push(`/recurring/${s.id}`)}
              divider={index < shown.length - 1}
            />
          ))}
        </Card>
      )}
    </DetailTemplate>
  );
}
