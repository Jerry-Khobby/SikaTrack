import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ProviderRow, WalletCard, type WalletCardProps } from '@/components/molecules';
import { Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type WalletChooserProps = {
  wallets: (Omit<WalletCardProps, 'onEdit'> & { id: string })[];
  providers: { code: string; name: string; supported: boolean }[];
  onAdd: (providerCode: string) => void;
  onEdit: (walletId: string) => void;
};

/** The user's wallets so far, then every provider with a way to add one. */
export function WalletChooser({ wallets, providers, onAdd, onEdit }: WalletChooserProps) {
  const theme = useTheme();

  return (
    <View>
      {wallets.length > 0 && (
        <View style={styles.section}>
          <ThemedText type="overline" themeColor="textSecondary" style={styles.heading}>
            Your wallets
          </ThemedText>
          <View style={styles.cards}>
            {wallets.map(({ id, ...wallet }) => (
              <WalletCard key={id} {...wallet} onEdit={() => onEdit(id)} />
            ))}
          </View>
        </View>
      )}
      <ThemedText type="overline" themeColor="textSecondary" style={styles.heading}>
        Add a wallet
      </ThemedText>
      <View style={[styles.providers, { backgroundColor: theme.surface }]}>
        {providers.map((provider, index) => (
          <ProviderRow
            key={provider.code}
            {...provider}
            onAdd={() => onAdd(provider.code)}
            divider={index < providers.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  heading: {
    marginBottom: Spacing.two,
  },
  cards: {
    gap: Spacing.two,
  },
  providers: {
    borderRadius: 16,
    overflow: 'hidden',
  },
});
