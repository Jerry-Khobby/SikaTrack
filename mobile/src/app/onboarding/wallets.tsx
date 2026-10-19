import { useRouter } from 'expo-router';
import type { CountryCode } from 'libphonenumber-js/mobile';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { WalletChooser, WalletSheet, type WalletFormValues } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useMe } from '@/hooks/use-me';
import { updateMe } from '@/services/me';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import {
  UnsupportedProviderError,
  WalletConflictError,
  addWallet,
  getAccountNameSuggestions,
  listWallets,
  updateWallet,
  type Wallet,
} from '@/services/wallets';
import { Spacing } from '@/theme';
import { countryOfNumber, formatNationalNumber } from '@/utils/phone';

type SheetState = { mode: 'add'; provider: string } | { mode: 'edit'; wallet: Wallet };

/** S08 · Add your wallets, so transfers between them aren't counted as spending. */
export default function WalletsScreen() {
  const router = useRouter();
  const config = useAppConfig();
  const me = useMe();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listWallets().then(setWallets);
    getAccountNameSuggestions().then(setNameSuggestions);
  }, []);

  const providers = config?.providers ?? [];
  const providerName = (code: string) => providers.find((p) => p.code === code)?.name ?? code;
  const country = ((me?.phoneNumber && countryOfNumber(me.phoneNumber)) ??
    config?.supportedCountries[0]) as CountryCode | undefined;

  const saveWallet = async (values: WalletFormValues) => {
    try {
      if (sheet?.mode === 'edit') {
        await updateWallet(sheet.wallet.id, { accountName: values.accountName, label: values.label });
      } else {
        await addWallet(values);
      }
    } catch (e) {
      if (e instanceof WalletConflictError) throw new Error('This wallet is already on your account.');
      if (e instanceof UnsupportedProviderError) throw new Error("We don't support this provider yet.");
      throw new Error("We couldn't save the wallet. Try again.");
    }
    setWallets(await listWallets());
    setSheet(null);
  };

  const proceed = async () => {
    setSaving(true);
    await updateMe({ onboarding: { walletsAdded: true } });
    setSaving(false);
    router.push('/onboarding/sync');
  };

  return (
    <OnboardingStepTemplate
      step={3}
      totalSteps={ONBOARDING_STEP_COUNT}
      footer={
        <Button
          label="Continue"
          onPress={proceed}
          disabled={wallets.length === 0}
          loading={saving}
        />
      }>
      <ThemedText type="title" accessibilityRole="header" style={styles.title}>
        Which wallets are yours?
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary" style={styles.subtitle}>
        So money moving between your own wallets isn't counted as spending.
      </ThemedText>
      <WalletChooser
        wallets={wallets.map((wallet) => ({
          id: wallet.id,
          providerCode: wallet.provider,
          providerName: providerName(wallet.provider),
          title: wallet.label ?? providerName(wallet.provider),
          subtitle: `${formatNationalNumber(wallet.phoneNumber)} · ${wallet.accountName}`,
        }))}
        providers={providers}
        onAdd={(provider) => setSheet({ mode: 'add', provider })}
        onEdit={(id) => {
          const wallet = wallets.find((w) => w.id === id);
          if (wallet) setSheet({ mode: 'edit', wallet });
        }}
      />
      {sheet && country && (
        <WalletSheet
          mode={sheet.mode}
          providers={providers.filter((provider) => provider.supported)}
          initial={
            sheet.mode === 'edit'
              ? {
                  provider: sheet.wallet.provider,
                  phoneNumber: sheet.wallet.phoneNumber,
                  accountName: sheet.wallet.accountName,
                  label: sheet.wallet.label ?? '',
                }
              : {
                  provider: sheet.provider,
                  // The first wallet is most likely the number they signed in with.
                  phoneNumber: wallets.length === 0 ? (me?.phoneNumber ?? '') : '',
                  accountName: '',
                  label: '',
                }
          }
          country={country}
          nameSuggestions={nameSuggestions}
          onSave={saveWallet}
          onClose={() => setSheet(null)}
        />
      )}
    </OnboardingStepTemplate>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 28,
    marginBottom: Spacing.two,
  },
  subtitle: {
    marginBottom: 20,
  },
});
