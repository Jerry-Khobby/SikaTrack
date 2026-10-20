import { View } from 'react-native';

import { IconButton, ProviderBadge, ThemedText } from '@/components/atoms';

export type WalletCardProps = {
  providerCode: string;
  providerName: string;
  title: string;
  subtitle: string;
  onEdit: () => void;
};

/** One of the user's own wallets, with an edit button. */
export function WalletCard({ providerCode, providerName, title, subtitle, onEdit }: WalletCardProps) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-surface py-[14px] pl-[14px] pr-1">
      <ProviderBadge code={providerCode} name={providerName} size={42} />
      <View className="min-w-0 flex-1">
        <ThemedText type="subheading" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>
      <IconButton icon="edit" accessibilityLabel={`Edit ${title}`} onPress={onEdit} />
    </View>
  );
}
