import { View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { WalletBalanceRow } from '@/components/molecules';
import type { Balances } from '@/services/balances';
import { formatDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

export type BalancesCardProps = {
  balances: Balances;
  /** Provider code → display name, for badges and unlabelled wallets. */
  providerNames: Record<string, string>;
  onPress?: () => void;
};

/** Total balance and one row per wallet (docs/ui-spec.md S12). */
export function BalancesCard({ balances, providerNames, onPress }: BalancesCardProps) {
  return (
    <Card onPress={onPress} accessibilityLabel={`Total balance ${formatMoney(balances.total, balances.currency)}`}>
      <View className="flex-row items-baseline justify-between">
        <ThemedText type="none" themeColor="textSecondary" className="font-sans-semibold text-[13px] leading-[18px]">
          Total balance
        </ThemedText>
        <ThemedText
          type="none"
          className="font-sans-extrabold text-[20px] leading-[26px]"
          style={{ fontVariant: ['tabular-nums'] }}>
          {formatMoney(balances.total, balances.currency)}
        </ThemedText>
      </View>
      <View className="mt-3">
        {balances.wallets.map((wallet) => {
          const providerName = providerNames[wallet.provider] ?? wallet.provider;
          return (
            <WalletBalanceRow
              key={wallet.id}
              providerCode={wallet.provider}
              providerName={providerName}
              label={wallet.label ?? providerName}
              asOf={`as of ${formatDateTime(wallet.asOf)}`}
              balance={formatMoney(wallet.balance, balances.currency)}
              isLow={wallet.isLow}
            />
          );
        })}
      </View>
    </Card>
  );
}
