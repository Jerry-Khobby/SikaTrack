import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { NavigationRow, PermissionCard } from '@/components/molecules';
import { NotificationPreferences } from '@/components/organisms';
import { DetailTemplate } from '@/components/templates';
import { useGoBack } from '@/hooks/use-go-back';
import { useMe } from '@/hooks/use-me';
import { useUpdateMe } from '@/hooks/queries';
import { notificationChoices, type NotifyKey } from '@/services/me';
import { getNotificationPermission, openAppSettings, type PermissionResult } from '@/services/permissions';
import { formatMoney } from '@/utils/format';

/** S31 · Notification settings: which alerts to send, and whether Android lets them through. */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const goBack = useGoBack('/more');
  const me = useMe();
  const update = useUpdateMe();
  const [values, setValues] = useState<Record<NotifyKey, boolean>>();
  const [permission, setPermission] = useState<PermissionResult>();
  const [error, setError] = useState(false);

  useEffect(() => {
    if (me) setValues(me.settings.notify);
  }, [me]);

  // Checked again on coming back from Android settings.
  useEffect(() => {
    const check = () => getNotificationPermission().then(setPermission);
    check();
    const subscription = AppState.addEventListener('change', (state) => state === 'active' && check());
    return () => subscription.remove();
  }, []);

  const change = async (key: NotifyKey, value: boolean) => {
    if (!values) return;
    const previous = values;
    // The switch moves at once; it goes back if the save fails.
    setValues({ ...values, [key]: value });
    setError(false);
    try {
      await update.mutateAsync({ settings: { notify: { [key]: value } } });
    } catch {
      setValues(previous);
      setError(true);
    }
  };

  const allowed = permission !== 'denied';

  return (
    <DetailTemplate title="Notifications" onBack={goBack} gutter="narrow">
      {permission && (
        <PermissionCard
          allowed={allowed}
          title={allowed ? 'Android notifications are on' : 'Android notifications are off'}
          message={allowed ? 'SikaTrack can send you alerts.' : "You won't get any of these until you turn them on."}
          actionLabel={allowed ? 'Android settings' : 'Open Android settings'}
          onAction={openAppSettings}
        />
      )}
      {error && (
        <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite" className="mx-1">
          We couldn't save that change. Check your connection and try again.
        </ThemedText>
      )}
      {me && values && (
        <NotificationPreferences options={notificationChoices(me.settings)} values={values} onChange={change} />
      )}
      {me && (
        <NavigationRow
          icon="alert"
          title="Low-balance amount"
          subtitle={`Alert when a wallet drops below ${formatMoney(me.settings.lowBalanceThreshold, me.settings.currency)}`}
          onPress={() => router.push('/low-balance')}
        />
      )}
    </DetailTemplate>
  );
}
