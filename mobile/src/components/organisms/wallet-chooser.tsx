import { View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ProviderRow, WalletCard, type WalletCardProps } from '@/components/molecules';

export type WalletChooserProps = {
  wallets: (Omit<WalletCardProps, 'onEdit'> & { id: string })[];
  providers: { code: string; name: string; supported: boolean }[];
  onAdd: (providerCode: string) => void;
  onEdit: (walletId: string) => void;
};

/** The user's wallets so far, then every provider with a way to add one. */
export function WalletChooser({ wallets, providers, onAdd, onEdit }: WalletChooserProps) {
  return (
    <View>
      {wallets.length > 0 && (
        <View className="mb-5">
          <ThemedText type="overline" themeColor="textSecondary" className="mb-2">
            Your wallets
          </ThemedText>
          <View className="gap-2">
            {wallets.map(({ id, ...wallet }) => (
              <WalletCard key={id} {...wallet} onEdit={() => onEdit(id)} />
            ))}
          </View>
        </View>
      )}
      <ThemedText type="overline" themeColor="textSecondary" className="mb-2">
        Add a wallet
      </ThemedText>
      <View className="overflow-hidden rounded-2xl bg-surface">
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
