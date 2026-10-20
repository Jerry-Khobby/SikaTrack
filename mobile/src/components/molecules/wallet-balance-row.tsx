import { StyleSheet, View } from 'react-native';

import { Pill, ProviderBadge, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type WalletBalanceRowProps = {
  providerCode: string;
  providerName: string;
  label: string;
  /** E.g. `as of Today, 09:32`. */
  asOf: string;
  balance: string;
  isLow: boolean;
};

/** One wallet's latest balance, in red with "Low" under the alert amount. */
export function WalletBalanceRow({ providerCode, providerName, label, asOf, balance, isLow }: WalletBalanceRowProps) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${balance}${isLow ? ', low' : ''}, ${asOf}`}
      style={[styles.row, { borderTopColor: theme.divider }]}>
      <ProviderBadge code={providerCode} name={providerName} size={32} />
      <View style={styles.text}>
        <ThemedText style={styles.label} numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" style={styles.asOf}>
          {asOf}
        </ThemedText>
      </View>
      <View style={styles.amount}>
        {isLow && <Pill label="Low" tone="red" />}
        <ThemedText style={[styles.balance, isLow && { color: theme.iconRed }]}>{balance}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  asOf: {
    fontSize: 11,
    lineHeight: 15,
  },
  amount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balance: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
});
