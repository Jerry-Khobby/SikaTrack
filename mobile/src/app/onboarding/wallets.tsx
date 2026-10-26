import { useFocusEffect, useRouter } from 'expo-router';
import type { CountryCode } from 'libphonenumber-js/mobile';
import { useCallback, useEffect, useState } from 'react';

import { Button, ThemedText } from '@/components/atoms';
import { WalletChooser, WalletSheet, type WalletFormValues } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useMe } from '@/hooks/use-me';
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

  // Again on coming back from confirming a wallet's number.
  useFocusEffect(
    useCallback(() => {
      listWallets().then(setWallets);
    }, []),
  );
  useEffect(() => {
    getAccountNameSuggestions().then(setNameSuggestions);
  }, []);

  const confirmNumber = (wallet: Wallet) =>
    router.push({ pathname: '/verify-wallet/[id]', params: { id: wallet.id, phoneNumber: wallet.phoneNumber } });

  const providers = config?.providers ?? [];
  const providerName = (code: string) => providers.find((p) => p.code === code)?.name ?? code;
  const country = ((me?.phoneNumber && countryOfNumber(me.phoneNumber)) ??
    config?.supportedCountries[0]) as CountryCode | undefined;

  const saveWallet = async (values: WalletFormValues) => {
    let added: Wallet | undefined;
    try {
      if (sheet?.mode === 'edit') {
        await updateWallet(sheet.wallet.id, { accountName: values.accountName, label: values.label });
      } else {
        added = await addWallet(values);
      }
    } catch (e) {
      if (e instanceof WalletConflictError) throw new Error('This wallet is already on your account.');
      if (e instanceof UnsupportedProviderError) throw new Error("We don't support this provider yet.");
      throw new Error("We couldn't save the wallet. Try again.");
    }
    setWallets(await listWallets());
    setSheet(null);
    // A number other than the sign-in one: prove it's theirs with the code texted to it.
    if (added && !added.verified) confirmNumber(added);
  };

  // Confirming a wallet already marked this step done on the server.
  const proceed = () => router.push('/onboarding/sync');

  return (
    <OnboardingStepTemplate
      step={3}
      totalSteps={ONBOARDING_STEP_COUNT}
      footer={
        <Button
          label="Continue"
          onPress={proceed}
          disabled={!wallets.some((wallet) => wallet.verified)}
        />
      }>
      <ThemedText type="title" accessibilityRole="header" className="mb-2 mt-7">
        Which wallets are yours?
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-5">
        So money moving between your own wallets isn't counted as spending.
      </ThemedText>
      <WalletChooser
        wallets={wallets.map((wallet) => ({
          id: wallet.id,
          providerCode: wallet.provider,
          providerName: providerName(wallet.provider),
          title: wallet.label ?? providerName(wallet.provider),
          subtitle: wallet.verified
            ? `${formatNationalNumber(wallet.phoneNumber)} · ${wallet.accountName}`
            : `${formatNationalNumber(wallet.phoneNumber)} · Not confirmed: tap to enter the code`,
        }))}
        providers={providers}
        onAdd={(provider) => setSheet({ mode: 'add', provider })}
        onEdit={(id) => {
          const wallet = wallets.find((w) => w.id === id);
          if (wallet) {
            if (wallet.verified) setSheet({ mode: 'edit', wallet });
            else confirmNumber(wallet);
          }
        }}
        onLearnMore={(code) => router.push({ pathname: '/providers/[code]', params: { code } })}
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

