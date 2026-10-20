import { View } from 'react-native';

import { Pill, ProviderBadge, ThemedText } from '@/components/atoms';

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
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${balance}${isLow ? ', low' : ''}, ${asOf}`}
      className="flex-row items-center gap-2.5 border-t border-divider py-2">
      <ProviderBadge code={providerCode} name={providerName} size={32} />
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-bold text-[14px] leading-[19px]" numberOfLines={1}>
          {label}
        </ThemedText>
        <ThemedText type="none" themeColor="textSecondary" className="font-sans text-[11px] leading-[15px]">
          {asOf}
        </ThemedText>
      </View>
      <View className="flex-row items-center gap-1.5">
        {isLow && <Pill label="Low" tone="red" />}
        <ThemedText
          type="none"
          themeColor="none"
          className={`font-sans-bold text-[15px] ${isLow ? 'text-icon-red' : 'text-content'}`}
          style={{ fontVariant: ['tabular-nums'] }}>
          {balance}
        </ThemedText>
      </View>
    </View>
  );
}
