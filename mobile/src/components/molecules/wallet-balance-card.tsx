import { View } from 'react-native';

import { IconButton, Pill, ProviderBadge, ThemedText } from '@/components/atoms';

export type WalletBalanceCardProps = {
  providerCode: string;
  providerName: string;
  title: string;
  /** E.g. `024 123 4567 · JERRY K MENSAH`. */
  subtitle: string;
  balance: string;
  /** E.g. `as of Today, 09:32`. */
  asOf: string;
  isLow: boolean;
  onOptions: () => void;
};

/** One wallet on S26: badge, label, number and name, its balance, and a ⋯ menu. */
export function WalletBalanceCard({ providerCode, providerName, title, subtitle, balance, asOf, isLow, onOptions }: WalletBalanceCardProps) {
  return (
    <View className={`rounded-[20px] bg-surface p-4 ${isLow ? 'border-[1.5px] border-status-bad' : ''}`}>
      <View className="flex-row items-start gap-3">
        <ProviderBadge code={providerCode} name={providerName} size={44} />
        <View className="min-w-0 flex-1">
          <ThemedText type="none" className="font-sans-extrabold text-[16px] leading-[22px]" numberOfLines={1}>
            {title}
          </ThemedText>
          <ThemedText type="fine" themeColor="textSecondary" className="mt-0.5" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
        <View className="-mr-2 -mt-1.5">
          <IconButton icon="dots" accessibilityLabel={`Options for ${title}`} onPress={onOptions} />
        </View>
      </View>
      <View className="mt-[14px] flex-row items-baseline justify-between">
        <View className="flex-row items-center gap-2">
          <ThemedText
            type="none"
            themeColor="none"
            className={`font-sans-bold text-[22px] leading-[28px] ${isLow ? 'text-icon-red' : 'text-content'}`}
            style={{ fontVariant: ['tabular-nums'] }}>
            {balance}
          </ThemedText>
          {isLow && <Pill label="Low" tone="red" />}
        </View>
        <ThemedText type="fine" themeColor="textSecondary">
          {asOf}
        </ThemedText>
      </View>
    </View>
  );
}
