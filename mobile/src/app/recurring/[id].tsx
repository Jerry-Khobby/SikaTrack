import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, CategoryGlyph, Icon, Pill, ThemedText } from '@/components/atoms';
import { ErrorState, RadioCard, SectionHeader, StatLine } from '@/components/molecules';
import { PaymentTimeline, TextPromptSheet } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useRecurringPayments, useRecurringSeries, useUpdateRecurring } from '@/hooks/queries';
import { RHYTHM_LABELS, isStillCharging, type RecurringDecision } from '@/services/recurring';
import { formatDayMonth, formatWeekdayDate } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

const DECISIONS: { value: RecurringDecision; title: string; description: string }[] = [
  { value: 'expected', title: 'Expected', description: 'I mean to keep paying this.' },
  { value: 'cancel_planned', title: 'I plan to cancel', description: "Warn me if it's still charging." },
  { value: 'not_recurring', title: 'Not recurring', description: 'It just looked regular. Hide it.' },
];

/** S29 · One recurring payment: what it costs, the user's plan for it, and every payment. */
export default function RecurringDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack('/recurring');
  const theme = useTheme();
  const me = useMe();
  const [renaming, setRenaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const series = useRecurringSeries(id);
  const payments = useRecurringPayments(id);
  const update = useUpdateRecurring(id);

  const currency = me?.settings.currency ?? '';
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([series.refetch(), payments.refetch()]);
    setRefreshing(false);
  };

  if (series.isError) {
    return (
      <DetailTemplate onBack={goBack}>
        <ErrorState title="We couldn't load this payment" requestId={requestIdOf(series.error)} onRetry={refresh} />
      </DetailTemplate>
    );
  }

  if (series.isPending) {
    return (
      <DetailTemplate onBack={goBack}>
        <View className="h-[120px] rounded-[20px] bg-skeleton" />
        <View className="h-[240px] rounded-[20px] bg-skeleton" />
      </DetailTemplate>
    );
  }

  const s = series.data;
  const stopped = s.status === 'stopped';
  const charging = isStillCharging(s);
  const choose = (decision: RecurringDecision) => {
    update.mutate({ userState: decision }, decision === 'not_recurring' ? { onSuccess: goBack } : undefined);
  };

  return (
    <DetailTemplate onBack={goBack} refreshing={refreshing} onRefresh={refresh}>
      <View className="items-center px-2 pb-1">
        <View className={`h-16 w-16 items-center justify-center rounded-[32px] bg-avatar ${stopped ? 'opacity-50' : ''}`}>
          <CategoryGlyph categoryId={s.category.id} kind={s.counterparty.kind} color={theme.text} size={28} />
        </View>
        <ThemedText type="none" accessibilityRole="header" className="mt-3 text-center font-sans-extrabold text-[22px] leading-[28px]">
          {s.counterparty.name}
        </ThemedText>
        <View className="mt-1 flex-row items-center gap-2">
          <ThemedText type="caption" themeColor="textSecondary">
            {s.label}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rename ${s.label}`}
            onPress={() => setRenaming(true)}
            hitSlop={10}>
            <Text className="font-sans-bold text-[13px] text-link">Rename</Text>
          </Pressable>
        </View>
        <View className="mt-2">
          <Pill label={stopped ? 'Stopped' : 'Active'} tone={stopped ? 'neutral' : 'green'} />
        </View>
      </View>

      {charging && (
        <View accessibilityRole="alert" className="flex-row gap-3 rounded-2xl bg-tint-red p-4">
          <Icon name="alert" color={theme.iconRed} size={20} />
          <View className="flex-1">
            <ThemedText type="none" themeColor="none" className="font-sans-extrabold text-[14px] leading-[20px] text-icon-red">
              Still charging
            </ThemedText>
            <ThemedText type="caption" className="mt-0.5">
              You planned to cancel this, but it was paid again on {formatDayMonth(s.lastPaidAt)}. Check it's really cancelled with{' '}
              {s.counterparty.name}.
            </ThemedText>
          </View>
        </View>
      )}

      <Card>
        <SectionHeader title="Details" />
        <StatLine label="Category" value={s.category.name} divider />
        <StatLine label="Rhythm" value={RHYTHM_LABELS[s.rhythm] ?? s.rhythm} divider />
        <StatLine label="Typical amount" value={formatMoney(s.typicalAmount, currency)} divider />
        <StatLine label="Monthly cost" value={stopped ? '—' : formatMoney(s.monthlyCost, currency)} divider />
        <StatLine
          label="First and last payment"
          value={`${formatDayMonth(s.firstPaidAt)} – ${formatDayMonth(s.lastPaidAt)}`}
          divider
        />
        <StatLine label="Payments" value={String(s.payments)} />
      </Card>

      <View>
        <SectionHeader title="Your decision" />
        <View accessibilityRole="radiogroup" className="gap-2">
          {DECISIONS.map((decision) => (
            <RadioCard
              key={decision.value}
              title={decision.title}
              description={decision.description}
              selected={s.userState === decision.value}
              onPress={() => choose(decision.value)}
            />
          ))}
        </View>
      </View>

      {payments.data && payments.data.length > 0 && (
        <PaymentTimeline
          payments={payments.data.map((t) => ({
            id: t.id,
            date: formatWeekdayDate(t.occurredAt),
            amount: formatMoney(t.amount, currency),
            note: t.fee && Number(t.fee) > 0 ? `+ ${formatMoney(t.fee, currency)} fee` : undefined,
          }))}
          onPressPayment={(paymentId) => router.push(`/transactions/${paymentId}`)}
        />
      )}

      {renaming && (
        <TextPromptSheet
          title="Rename"
          label="What is this payment for?"
          initial={s.label}
          onSave={async (label) => {
            try {
              await update.mutateAsync({ label });
            } catch {
              throw new Error("We couldn't rename it. Try again.");
            }
            setRenaming(false);
          }}
          onClose={() => setRenaming(false)}
        />
      )}
    </DetailTemplate>
  );
}
