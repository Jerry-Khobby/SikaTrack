import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { ScreenTitle } from '@/components/molecules';
import { ConfirmDialog, MenuSection } from '@/components/organisms';
import { TabScreenTemplate } from '@/components/templates';
import { useMe } from '@/hooks/use-me';
import { useTheme } from '@/hooks/use-theme';
import { useSyncStatus } from '@/hooks/queries';
import { signOut } from '@/services/auth';
import { syncState } from '@/services/sync';
import { formatMoney } from '@/utils/format';
import { formatPhoneNumber } from '@/utils/phone';

/** S25 · More: wallets, recurring payments, settings and the account. */
export default function MoreScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const theme = useTheme();
  const me = useMe();
  const sync = useSyncStatus();
  const [signingOut, setSigningOut] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const name = me?.displayName || 'You';
  const phone = me?.phoneNumber ? formatPhoneNumber(me.phoneNumber) : '';
  const threshold = me ? formatMoney(me.settings.lowBalanceThreshold, me.settings.currency) : undefined;
  const syncDetail = !sync.data
    ? undefined
    : {
        up_to_date: 'Up to date',
        processing: `${sync.data.pendingMessages + sync.data.provisionalTransactions} processing`,
        delayed: 'Delayed',
      }[syncState(sync.data)];

  const confirmSignOut = async () => {
    setLeaving(true);
    try {
      await signOut();
    } finally {
      // Nothing cached from this account should show after the next sign-in.
      client.clear();
      setLeaving(false);
      setSigningOut(false);
      router.replace('/welcome');
    }
  };

  return (
    <TabScreenTemplate>
      <View className="gap-5 px-4 pt-[18px]">
        <View>
          <ScreenTitle title="More" />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Profile: ${name}${phone ? `, ${phone}` : ''}`}
            onPress={() => router.push('/profile')}
            className="flex-row items-center gap-[14px] rounded-[20px] bg-surface p-4 active:opacity-[0.85]">
            <View className="h-[52px] w-[52px] items-center justify-center rounded-[26px] bg-brand-gold">
              <Text className="font-sans-extrabold text-[22px] text-brand-ink">{name.charAt(0).toUpperCase()}</Text>
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
            <Icon name="chevron-right" color={theme.textDisabled} size={18} />
          </Pressable>
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
            { key: 'notifications', icon: 'bell', label: 'Notifications', onPress: () => router.push('/notification-settings') },
            { key: 'low-balance', icon: 'alert', label: 'Low-balance alert', detail: threshold, onPress: () => router.push('/low-balance') },
            { key: 'sync', icon: 'sync', label: 'Sync status', detail: syncDetail, onPress: () => router.push('/sync') },
          ]}
        />
        <MenuSection
          title="Privacy"
          rows={[
            { key: 'privacy', icon: 'shield', label: 'How we handle your data', onPress: () => router.push('/privacy') },
            // Export isn't built yet (`features.export` is off), so it shows "Coming soon".
            { key: 'export', icon: 'download', label: 'Export my data' },
          ]}
        />
        <MenuSection
          title="Account"
          rows={[
            { key: 'sign-out', icon: 'log-out', label: 'Sign out', onPress: () => setSigningOut(true) },
            { key: 'delete', icon: 'trash', label: 'Delete account', danger: true, onPress: () => router.push('/delete-account') },
          ]}
        />

        <ThemedText type="fine" themeColor="textSecondary" className="pb-2 text-center">
          SikaTrack {Constants.expoConfig?.version ?? ''} · Made in Ghana
        </ThemedText>
      </View>

      {signingOut && (
        <ConfirmDialog
          title="Sign out of SikaTrack on this phone?"
          message="Your data stays safe. Sign in again any time with your phone number."
          confirmLabel="Sign out"
          busy={leaving}
          onConfirm={confirmSignOut}
          onCancel={() => setSigningOut(false)}
        />
      )}
    </TabScreenTemplate>
  );
}
