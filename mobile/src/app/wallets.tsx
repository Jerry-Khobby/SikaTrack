import { useRouter } from 'expo-router';
import type { CountryCode } from 'libphonenumber-js/mobile';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Button, TextLink, ThemedText } from '@/components/atoms';
import { ErrorState, MenuRow, WalletBalanceCard } from '@/components/molecules';
import {
  BalanceHistoryCard,
  BottomSheet,
  ConfirmDialog,
  WalletSheet,
  type WalletFormValues,
} from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { requestIdOf } from '@/api/query-client';
import { useAppConfig } from '@/hooks/use-app-config';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useProviderNames } from '@/hooks/use-provider-names';
import {
  useAddWallet,
  useBalanceHistory,
  useBalances,
  useRemoveWallet,
  useUpdateWallet,
  useWalletDetails,
} from '@/hooks/queries';
import { HISTORY_RANGES, type HistoryRange } from '@/services/balances';
import { UnsupportedProviderError, WalletConflictError, getAccountNameSuggestions, type Wallet } from '@/services/wallets';
import { DataColors } from '@/theme/colors';
import { formatDateTime, formatDayMonth, formatWeekdayDate } from '@/utils/dates';
import { formatMoney } from '@/utils/format';
import { countryOfNumber, formatNationalNumber } from '@/utils/phone';

type SheetState = { mode: 'add' } | { mode: 'edit'; wallet: Wallet };

/** S26 · Wallets: each wallet's balance, the history behind it, and adding or removing wallets. */
export default function WalletsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  const me = useMe();
  const config = useAppConfig();
  const providerNames = useProviderNames();
  const [range, setRange] = useState<HistoryRange>('1M');
  const [options, setOptions] = useState<Wallet | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [removing, setRemoving] = useState<Wallet | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const balances = useBalances();
  const wallets = useWalletDetails();
  const history = useBalanceHistory(range);
  const addWallet = useAddWallet();
  const updateWallet = useUpdateWallet();
  const removeWallet = useRemoveWallet();

  const currency = balances.data?.currency ?? me?.settings.currency ?? '';
  const providerName = (code: string) => providerNames[code] ?? code;
  const titleOf = (wallet: Pick<Wallet, 'label' | 'provider'>) => wallet.label ?? providerName(wallet.provider);
  const country = ((me?.phoneNumber && countryOfNumber(me.phoneNumber)) ?? config?.supportedCountries[0]) as
    | CountryCode
    | undefined;

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([balances.refetch(), wallets.refetch(), history.refetch()]);
    setRefreshing(false);
  };

  const saveWallet = async (values: WalletFormValues) => {
    try {
      if (sheet?.mode === 'edit') {
        await updateWallet.mutateAsync({
          id: sheet.wallet.id,
          changes: { accountName: values.accountName, label: values.label },
        });
      } else {
        await addWallet.mutateAsync(values);
      }
    } catch (e) {
      if (e instanceof WalletConflictError) throw new Error('This wallet is already on your account.');
      if (e instanceof UnsupportedProviderError) throw new Error("We don't support this provider yet.");
      throw new Error("We couldn't save the wallet. Try again.");
    }
    setSheet(null);
  };

  const confirmRemove = async () => {
    if (!removing) return;
    await removeWallet.mutateAsync(removing.id);
    setRemoving(null);
  };

  if (balances.isError || wallets.isError) {
    return (
      <DetailTemplate title="Wallets" onBack={goBack} gutter="narrow">
        <ErrorState
          title="We couldn't load your wallets"
          requestId={requestIdOf(balances.error ?? wallets.error)}
          onRetry={refresh}
        />
      </DetailTemplate>
    );
  }

  const walletList = wallets.data ?? [];
  // Every day any wallet has a balance; a wallet added later has a gap before its first SMS.
  const dates = Array.from(new Set((history.data?.series ?? []).flatMap((s) => s.points.map((p) => p.date)))).sort();
  const lines = (history.data?.series ?? []).map((series, index) => {
    const wallet = walletList.find((w) => w.id === series.walletId);
    const byDate = new Map(series.points.map((p) => [p.date, Number(p.balance)]));
    return {
      key: series.walletId,
      label: wallet ? titleOf(wallet) : 'Removed wallet',
      // Colours go in order; past five wallets the rest share the neutral one.
      color: DataColors.categories[index] ?? DataColors.categoryOther,
      values: dates.map((date) => byDate.get(date) ?? null),
    };
  });
  const xLabels = dates.length
    ? [formatDayMonth(dates[0]), formatDayMonth(dates[Math.floor((dates.length - 1) / 2)]), 'Today']
    : [];
  const threshold = history.data?.threshold ?? me?.settings.lowBalanceThreshold ?? '0';
  const below = history.data?.daysBelowThreshold ?? 0;

  return (
    <DetailTemplate title="Wallets" onBack={goBack} gutter="narrow" refreshing={refreshing} onRefresh={refresh}>
      <View className="px-1 pb-1">
        <ThemedText type="caption" themeColor="textSecondary">
          Total balance
        </ThemedText>
        {balances.data ? (
          <ThemedText
            type="none"
            className="font-sans-extrabold text-[32px] leading-[40px]"
            style={{ fontVariant: ['tabular-nums'] }}>
            {formatMoney(balances.data.total, currency)}
          </ThemedText>
        ) : (
          <View className="mt-1 h-10 w-48 rounded-sm bg-skeleton" />
        )}
      </View>

      {balances.isPending || wallets.isPending
        ? [0, 1].map((i) => <View key={i} className="h-[132px] rounded-[20px] bg-skeleton" />)
        : walletList.map((wallet) => {
            const balance = balances.data?.wallets.find((b) => b.id === wallet.id);
            return (
              <WalletBalanceCard
                key={wallet.id}
                providerCode={wallet.provider}
                providerName={providerName(wallet.provider)}
                title={titleOf(wallet)}
                subtitle={`${formatNationalNumber(wallet.phoneNumber)} · ${wallet.accountName}`}
                balance={balance ? formatMoney(balance.balance, currency) : '—'}
                asOf={balance ? `as of ${formatDateTime(balance.asOf)}` : 'No SMS yet'}
                isLow={balance?.isLow ?? false}
                onOptions={() => setOptions(wallet)}
              />
            );
          })}

      {walletList.length > 0 && (
        <BalanceHistoryCard
          ranges={HISTORY_RANGES}
          range={range}
          onRangeChange={(next) => setRange(next as HistoryRange)}
          lines={lines}
          threshold={Number(threshold)}
          days={dates.map((date) => formatWeekdayDate(date))}
          xLabels={xLabels}
          thresholdLabel={formatMoney(threshold, currency)}
          unit={currency}
          formatAmount={(value) => formatMoney(value.toFixed(2), currency)}
          footnote={`${below} day${below === 1 ? '' : 's'} below ${formatMoney(threshold, currency)} this month`}
          loading={history.isPending}
        />
      )}

      <Button variant="secondary" label="+ Add wallet" onPress={() => setSheet({ mode: 'add' })} />
      {(config?.providers ?? [])
        .filter((p) => !p.supported)
        .map((p) => (
          <ThemedText key={p.code} type="caption" themeColor="textSecondary" className="text-center">
            {p.name} is coming soon.{' '}
            <TextLink bold onPress={() => router.push({ pathname: '/providers/[code]', params: { code: p.code } })}>
              What that means
            </TextLink>
          </ThemedText>
        ))}

      {options && (
        <BottomSheet title={titleOf(options)} onClose={() => setOptions(null)}>
          <View className="-mx-4">
            <MenuRow
              icon="edit"
              label="Edit wallet"
              divider
              onPress={() => {
                setSheet({ mode: 'edit', wallet: options });
                setOptions(null);
              }}
            />
            <MenuRow
              icon="trash"
              label="Remove wallet"
              danger
              onPress={() => {
                setRemoving(options);
                setOptions(null);
              }}
            />
          </View>
        </BottomSheet>
      )}
      {sheet && country && (
        <WalletSheetLoader
          sheet={sheet}
          providers={(config?.providers ?? []).filter((p) => p.supported)}
          country={country}
          onSave={saveWallet}
          onClose={() => setSheet(null)}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Remove ${titleOf(removing)}?`}
          message="Your past transactions stay. Transfers to this number will count as spending again."
          confirmLabel="Remove"
          destructive
          busy={removeWallet.isPending}
          onConfirm={confirmRemove}
          onCancel={() => setRemoving(null)}
        />
      )}
    </DetailTemplate>
  );
}

/** Opens the S27 sheet once the "Is this you?" name suggestions are in. */
function WalletSheetLoader({
  sheet,
  providers,
  country,
  onSave,
  onClose,
}: {
  sheet: SheetState;
  providers: { code: string; name: string }[];
  country: CountryCode;
  onSave: (values: WalletFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  useEffect(() => {
    getAccountNameSuggestions().then(setSuggestions);
  }, []);

  return (
    <WalletSheet
      mode={sheet.mode}
      providers={providers}
      initial={
        sheet.mode === 'edit'
          ? {
              provider: sheet.wallet.provider,
              phoneNumber: sheet.wallet.phoneNumber,
              accountName: sheet.wallet.accountName,
              label: sheet.wallet.label ?? '',
            }
          : { provider: providers[0]?.code ?? '', phoneNumber: '', accountName: '', label: '' }
      }
      country={country}
      nameSuggestions={suggestions}
      onSave={onSave}
      onClose={onClose}
    />
  );
}
