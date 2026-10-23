import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Card, IconButton, ThemedText } from '@/components/atoms';
import { ErrorState, InfoNote, NavigationRow, StatLine } from '@/components/molecules';
import {
  CategoryPickerSheet,
  NoteCard,
  SmsCard,
  TransactionCategoryCard,
  TransactionHero,
  type CategoryChoice,
} from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useProviderNames, useProviderSenders } from '@/hooks/use-provider-names';
import { useTheme } from '@/hooks/use-theme';
import { useCategories, useRecurringOverview, useTransaction, useUpdateTransaction } from '@/hooks/queries';
import type { TransactionDetail, TransactionType } from '@/services/transactions';
import { formatDateTime } from '@/utils/dates';
import { routeForLink } from '@/utils/deep-links';
import { formatMoney } from '@/utils/format';
import { fromPesewas, toPesewas } from '@/utils/money';

const TYPE_LABELS: Record<TransactionType, string> = {
  transfer: 'Transfer',
  airtime: 'Airtime or data',
  cashout: 'Cash out',
  cashin: 'Cash in',
  merchant: 'Merchant payment',
  bank_transfer: 'Bank transfer',
  refund: 'Refund',
  interest: 'Interest',
  savings: 'Savings',
  reversal: 'Reversal',
};

/** Why the transaction has its category (docs/ui-spec.md S15, point 2). */
function categoryReason(t: TransactionDetail) {
  if (t.categorySource === 'user') return 'You set this';
  if (t.categorySource === 'counterparty_default') return `Your default for ${t.counterparty.name}`;
  return t.categoryExplanation;
}

/** S15 · Transaction detail: everything about one payment, and the place to correct it. */
export default function TransactionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const goBack = useGoBack('/transactions');
  const providerNames = useProviderNames();
  const senders = useProviderSenders();
  const query = useTransaction(id);
  const update = useUpdateTransaction(id);
  const categories = useCategories();
  // Every series, so a stopped one still names the row.
  const recurring = useRecurringOverview('all');
  const [note, setNote] = useState('');
  const [picking, setPicking] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = query.data;

  useEffect(() => {
    if (t) setNote(t.note ?? '');
  }, [t?.id, t?.note]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!t) {
    return (
      <DetailTemplate onBack={goBack}>
        {query.isError ? (
          <ErrorState
            title="We couldn't load this payment"
            requestId={requestIdOf(query.error)}
            onRetry={() => query.refetch()}
          />
        ) : (
          <ActivityIndicator className="mt-16" color={theme.text} accessibilityLabel="Loading" />
        )}
      </DetailTemplate>
    );
  }

  const seeAllPayments = () =>
    router.navigate({
      pathname: '/transactions',
      params: { counterpartyId: t.counterparty.id, counterpartyName: t.counterparty.name },
    });

  const saveNote = () => {
    const next = note.trim() || null;
    if (next !== (t.note ?? null)) update.mutate({ note: next });
  };

  const saveCategory = (choice: CategoryChoice) =>
    update.mutate(
      { category: choice.category, applyToCounterparty: choice.applyToCounterparty },
      { onSuccess: () => setPicking(false) },
    );

  const copyId = async () => {
    if (!t.providerTxnId) return;
    await Clipboard.setStringAsync(t.providerTxnId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const providerName = providerNames[t.provider] ?? t.provider;
  const series = recurring.data?.series.find((s) => s.id === t.recurringId);
  const recurringRoute = t.recurringId ? routeForLink(`sikatrack://recurring/${t.recurringId}`) : null;
  const totalCost = fromPesewas(toPesewas(t.amount) + toPesewas(t.totalCost));
  const details: { label: string; value: string }[] = [
    { label: 'Type', value: t.type ? (TYPE_LABELS[t.type] ?? t.type) : 'Unknown' },
    { label: 'Fee', value: formatMoney(t.fee, t.currency) },
    { label: 'Tax', value: formatMoney(t.tax, t.currency) },
    ...(t.direction === 'out' ? [{ label: 'Total cost', value: formatMoney(totalCost, t.currency) }] : []),
    ...(t.balanceAfter ? [{ label: 'Balance after', value: formatMoney(t.balanceAfter, t.currency) }] : []),
    ...(t.reference ? [{ label: 'Reference', value: t.reference }] : []),
  ];

  return (
    <DetailTemplate onBack={goBack} gutter="narrow" refreshing={query.isRefetching} onRefresh={() => query.refetch()}>
      <TransactionHero
        transaction={t}
        providerName={providerName}
        // A counterparty the SMS didn't name has no page, and one from a payment still processing
        // has none until the pipeline loads it.
        onPressCounterparty={
          t.counterparty.id && t.status === 'final'
            ? () => router.push(`/counterparties/${t.counterparty.id}`)
            : undefined
        }
      />

      <TransactionCategoryCard
        categoryId={t.category.id}
        categoryName={t.category.name}
        kind={t.counterparty.kind}
        explanation={categoryReason(t)}
        onChange={() => setPicking(true)}
      />

      <Card radius={18} padded={false} className="px-4 py-1">
        {details.map((row, index) => (
          <StatLine
            key={row.label}
            label={row.label}
            value={row.value}
            divider={index < details.length - 1 || Boolean(t.providerTxnId)}
          />
        ))}
        {t.providerTxnId && (
          <StatLine
            label="Transaction ID"
            value={t.providerTxnId}
            trailing={
              copied ? (
                <ThemedText type="fine" themeColor="iconSuccess" accessibilityLiveRegion="polite" className="px-2">
                  Copied
                </ThemedText>
              ) : (
                <IconButton icon="copy" accessibilityLabel="Copy transaction ID" onPress={copyId} />
              )
            }
          />
        )}
      </Card>

      <NoteCard value={note} onChangeText={setNote} onBlur={saveNote} />

      {t.recurringId && recurringRoute && (
        <NavigationRow
          icon="repeat"
          title={series ? `Part of ${series.label}` : 'Part of a regular payment'}
          subtitle="A payment that repeats"
          onPress={() => router.navigate(recurringRoute)}
        />
      )}

      {t.flags.includes('balance_gap') && (
        <InfoNote
          icon="alert"
          tone="warning"
          text="An SMS before this one seems to be missing, so the balance doesn't add up. That's fine; we still counted this payment."
        />
      )}
      {t.flags.includes('duplicate_sms_merged') && (
        <InfoNote icon="info" text="You received this SMS twice; we counted it once." />
      )}

      {/* The server keeps the SMS text with the confirmed payment, so a processing one has none yet. */}
      {t.smsText !== '' && (
        <SmsCard
          text={t.smsText}
          count={t.smsCount}
          sender={senders[t.provider] ?? null}
          time={formatDateTime(t.occurredAt)}
        />
      )}

      <View className="mt-1">
        {t.counterparty.id !== '' && (
          <Button variant="link" label={`See all payments to ${t.counterparty.name}`} onPress={seeAllPayments} />
        )}
      </View>

      {picking && (
        <CategoryPickerSheet
          categories={categories.data ?? []}
          currentId={t.category.id}
          counterpartyName={t.counterparty.name}
          userOverride={t.categorySource === 'user'}
          saving={update.isPending}
          error={update.isError ? "We couldn't save that. Try again." : undefined}
          onSave={saveCategory}
          onClose={() => setPicking(false)}
        />
      )}
    </DetailTemplate>
  );
}

