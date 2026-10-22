import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, CategoryGlyph, Icon, Pill, ThemedText } from '@/components/atoms';
import { ErrorState, FigureTile, SectionHeader, TextField, TransactionRow } from '@/components/molecules';
import { CategoryPickerSheet } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useProviderNames } from '@/hooks/use-provider-names';
import { useTheme } from '@/hooks/use-theme';
import { useCategories, useCounterparty, usePayments, useUpdateCounterparty } from '@/hooks/queries';
import { COUNTERPARTY_KIND_LABELS } from '@/services/counterparties';
import { DEFAULT_FILTERS, type TransactionFilters } from '@/services/transactions';
import { allTimeRange, formatDateTime, formatDayHeader } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

/** All of a counterparty's payments the API can return in one query, not just the last 30 days. */
const ALL_TIME = allTimeRange();

/** S20 · One person or place: what you've paid them, what to call them, and where their payments go. */
export default function CounterpartyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack('/counterparties');
  const theme = useTheme();
  const me = useMe();
  const providerNames = useProviderNames();
  const counterparty = useCounterparty(id);
  const categories = useCategories();
  const update = useUpdateCounterparty(id);
  const [alias, setAlias] = useState('');
  const [aliasError, setAliasError] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string>();

  const filters = useMemo<TransactionFilters>(
    () => ({ ...DEFAULT_FILTERS, date: ALL_TIME, counterparty: { id, name: counterparty.data?.name ?? '' } }),
    [id, counterparty.data?.name],
  );
  const payments = usePayments(filters, 20);
  const currency = me?.settings.currency ?? '';

  useEffect(() => {
    if (counterparty.data) setAlias(counterparty.data.alias ?? counterparty.data.name);
  }, [counterparty.data]);

  if (counterparty.isError) {
    return (
      <DetailTemplate onBack={goBack} gutter="narrow">
        <ErrorState title="We couldn't load them" requestId={requestIdOf(counterparty.error)} onRetry={() => counterparty.refetch()} />
      </DetailTemplate>
    );
  }
  if (counterparty.isPending) {
    return (
      <DetailTemplate onBack={goBack} gutter="narrow">
        <View className="h-[140px] rounded-[20px] bg-skeleton" />
      </DetailTemplate>
    );
  }

  const c = counterparty.data;
  const defaultCategory = categories.data?.find((cat) => cat.id === c.defaultCategory);
  const aliasChanged = alias.trim() !== (c.alias ?? c.name);

  const saveAlias = async () => {
    setAliasError(undefined);
    const next = alias.trim();
    try {
      // Clearing the field, or typing the SMS name back, removes the alias.
      await update.mutateAsync({ alias: !next || next.toUpperCase() === c.originalName ? null : next });
    } catch {
      setAliasError("We couldn't rename them. Try again.");
    }
  };

  return (
    <DetailTemplate onBack={goBack} gutter="narrow" refreshing={counterparty.isRefetching} onRefresh={() => counterparty.refetch()}>
      <View className="items-center px-2 pb-1">
        <View className="h-16 w-16 items-center justify-center rounded-[32px] bg-avatar">
          <CategoryGlyph kind={c.kind} color={theme.text} size={28} />
        </View>
        <ThemedText type="none" accessibilityRole="header" className="mt-3 text-center font-sans-extrabold text-[22px] leading-[28px]">
          {c.name}
        </ThemedText>
        {c.alias && (
          <ThemedText type="caption" themeColor="textSecondary" className="mt-0.5 text-center">
            {c.originalName}
          </ThemedText>
        )}
        <View className="mt-2">
          <Pill label={COUNTERPARTY_KIND_LABELS[c.kind]} />
        </View>
      </View>

      <View className="flex-row gap-2">
        <FigureTile compact label="Total paid" value={formatMoney(c.moneyOut, currency)} />
        <FigureTile compact label="Payments" value={String(c.transactions)} />
        <FigureTile compact label="Last paid" value={c.lastSeenAt ? formatDayHeader(c.lastSeenAt) : '—'} />
      </View>

      <Card>
        <TextField
          label="Rename"
          hint="Call them something else, e.g. Mum. It changes the name everywhere in the app."
          value={alias}
          onChangeText={setAlias}
          onSubmitEditing={saveAlias}
          returnKeyType="done"
          error={aliasError}
        />
        {aliasChanged && (
          <View className="mt-3">
            <Button label="Save name" onPress={saveAlias} loading={update.isPending} />
          </View>
        )}
      </Card>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Default category, ${defaultCategory?.name ?? 'none'}. Always file their payments under a category.`}
        onPress={() => setPicking(true)}
        className="flex-row items-center gap-3 rounded-[20px] bg-surface p-4 active:opacity-[0.85]">
        <View className="min-w-0 flex-1">
          <ThemedText type="none" className="font-sans-extrabold text-[15px] leading-[21px]">
            Default category
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            Always file their payments under…
          </ThemedText>
        </View>
        <ThemedText type="none" className="font-sans-bold text-[14px]">
          {defaultCategory?.name ?? 'None'}
        </ThemedText>
        <Icon name="chevron-right" color={theme.textDisabled} size={16} />
      </Pressable>

      <View>
        <SectionHeader
          title="Their payments"
          actionLabel={c.transactions > (payments.data?.items.length ?? 0) ? 'See all' : undefined}
          onAction={() =>
            router.navigate({ pathname: '/transactions', params: { counterpartyId: c.id, counterpartyName: c.name } })
          }
        />
        {payments.isPending ? (
          <View className="h-[160px] rounded-[20px] bg-skeleton" />
        ) : (
          <Card padded={false} className="overflow-hidden">
            {(payments.data?.items ?? []).map((t, index, list) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                providerName={providerNames[t.provider] ?? t.provider}
                timeLabel={formatDateTime(t.occurredAt)}
                onPress={() => router.push(`/transactions/${t.id}`)}
                divider={index < list.length - 1}
              />
            ))}
          </Card>
        )}
      </View>

      {picking && categories.data && (
        <CategoryPickerSheet
          title="Default category"
          showAlways={false}
          resetLabel="Don't use a default"
          categories={categories.data}
          currentId={c.defaultCategory ?? ''}
          counterpartyName={c.name}
          userOverride={c.defaultCategory !== null}
          saving={update.isPending}
          error={pickError}
          onSave={async ({ category }) => {
            setPickError(undefined);
            try {
              await update.mutateAsync({ defaultCategory: category });
              setPicking(false);
            } catch {
              setPickError("We couldn't save that. Try again.");
            }
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </DetailTemplate>
  );
}
