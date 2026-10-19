import { StyleSheet, View } from 'react-native';

import { IconButton, ProviderBadge, ThemedText } from '@/components/atoms';
import { Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type WalletCardProps = {
  providerCode: string;
  providerName: string;
  title: string;
  subtitle: string;
  onEdit: () => void;
};

/** One of the user's own wallets, with an edit button. */
export function WalletCard({ providerCode, providerName, title, subtitle, onEdit }: WalletCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <ProviderBadge code={providerCode} name={providerName} size={42} />
      <View style={styles.text}>
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

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingRight: Spacing.one,
    borderRadius: 16,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});
