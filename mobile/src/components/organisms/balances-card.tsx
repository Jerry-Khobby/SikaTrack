import { StyleSheet, View } from 'react-native';

import { Card, ThemedText } from '@/components/atoms';
import { WalletBalanceRow } from '@/components/molecules';
import { FontFamily } from '@/theme';
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
      <View style={styles.header}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.label}>
          Total balance
        </ThemedText>
        <ThemedText style={styles.total}>{formatMoney(balances.total, balances.currency)}</ThemedText>
      </View>
      <View style={styles.rows}>
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: FontFamily.semiBold,
  },
  total: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
  },
  rows: {
    marginTop: 12,
  },
});
