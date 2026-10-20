import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ScreenTitle } from '@/components/molecules';
import { ConfirmDialog, MenuSection } from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { useMe } from '@/hooks/use-me';
import { formatMoney } from '@/utils/format';
import { formatPhoneNumber } from '@/utils/phone';

/** S25 · More: wallets, recurring payments, settings and the account. */
export default function MoreScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const me = useMe();
  const [signingOut, setSigningOut] = useState(false);

  const name = me?.displayName ?? 'You';
  const phone = me?.phoneNumber ? formatPhoneNumber(me.phoneNumber) : '';
  const threshold = me ? formatMoney(me.settings.lowBalanceThreshold, me.settings.currency) : undefined;

  const signOut = () => {
    setSigningOut(false);
    // Nothing cached from this account should show after the next sign-in.
    client.clear();
    router.replace('/welcome');
  };

  return (
    <TabScreenTemplate>
      <View className="gap-5 px-4 pt-[18px]">
        <View>
          <ScreenTitle title="More" />
          <View className="flex-row items-center gap-[14px] rounded-[20px] bg-surface p-4">
            <View className="h-12 w-12 items-center justify-center rounded-3xl bg-brand-gold">
              <Text className="font-sans-extrabold text-[20px] text-brand-ink">{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View className="min-w-0 flex-1">
              <ThemedText type="none" className="font-sans-extrabold text-[17px] leading-[23px]" numberOfLines={1}>
                {name}
              </ThemedText>
              {phone !== '' && (
                <ThemedText type="caption" themeColor="textSecondary">
                  {phone}
                </ThemedText>
              )}
            </View>
          </View>
        </View>

        <MenuSection
          title="Money"
          rows={[
            { key: 'wallets', icon: 'wallet', label: 'Wallets and balances', onPress: () => router.push('/wallets') },
            { key: 'recurring', icon: 'repeat', label: 'Recurring payments', onPress: () => router.push('/recurring') },
            { key: 'people', icon: 'user', label: 'People and places', onPress: () => router.push('/counterparties') },
          ]}
        />
        <MenuSection
          title="App"
          rows={[
            { key: 'notifications', icon: 'bell', label: 'Notifications' },
            { key: 'low-balance', icon: 'alert', label: `Low-balance alert${threshold ? ` · ${threshold}` : ''}` },
            { key: 'sync', icon: 'sync', label: 'Sync status' },
          ]}
        />
        <MenuSection
          title="Privacy"
          rows={[
            { key: 'privacy', icon: 'shield', label: 'Privacy and your data', onPress: () => router.push('/privacy') },
            // Export isn't built yet (`features.export` is off), so it shows "Coming soon".
            { key: 'export', icon: 'download', label: 'Export my data' },
          ]}
        />
        <MenuSection
          title="Account"
          rows={[
            { key: 'sign-out', icon: 'log-out', label: 'Sign out', onPress: () => setSigningOut(true) },
            { key: 'delete', icon: 'trash', label: 'Delete account', danger: true },
          ]}
        />

        <View className="items-center gap-0.5 pb-2">
          <ThemedText type="fine" themeColor="textSecondary">
            SikaTrack {Constants.expoConfig?.version ?? ''}
          </ThemedText>
          <ThemedText type="fine" themeColor="textSecondary">
            Made in Ghana
          </ThemedText>
        </View>
      </View>

      {signingOut && (
        <ConfirmDialog
          title="Sign out of SikaTrack on this phone?"
          message="Your data stays safe. Sign in again any time with your phone number."
          confirmLabel="Sign out"
          destructive
          onConfirm={signOut}
          onCancel={() => setSigningOut(false)}
        />
      )}
    </TabScreenTemplate>
  );
}
