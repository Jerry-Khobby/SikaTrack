import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, ThemedText } from '@/components/atoms';
import { NotificationPreferences, type NotificationOption } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useMe } from '@/hooks/use-me';
import { updateMe, type Me, type NotifyKey } from '@/services/me';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { requestNotificationPermission } from '@/services/permissions';
import { formatMoney } from '@/utils/format';

function notificationOptions(settings: Me['settings']): NotificationOption<NotifyKey>[] {
  return [
    { key: 'budgets', title: 'Budget alerts', description: 'When a budget reaches 80% and 100%.' },
    {
      key: 'lowBalance',
      title: 'Low balance',
      description: `When a wallet drops below ${formatMoney(settings.lowBalanceThreshold, settings.currency)}.`,
    },
    {
      key: 'recurring',
      title: 'Recurring payments',
      description: 'New subscriptions, and ones still charging after you planned to cancel.',
    },
    {
      key: 'weeklySummary',
      title: 'Weekly summary',
      description: 'Your week in one message, every Monday.',
    },
    {
      key: 'dataReady',
      title: 'New data ready',
      description: 'When your latest SMS have been processed.',
    },
  ];
}

/** S10 · Notifications: ask for push permission, with the choices pre-set. */
export default function NotificationsScreen() {
  const router = useRouter();
  const me = useMe();
  const [values, setValues] = useState<Record<NotifyKey, boolean>>();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (me) {
      setValues(me.settings.notify);
    }
  }, [me]);

  const next = () => router.push('/onboarding/done');

  const turnOn = async () => {
    setAsking(true);
    const result = await requestNotificationPermission();
    if (result === 'granted' && values) {
      await updateMe({ settings: { notify: values } });
    }
    setAsking(false);
    next();
  };

  return (
    <OnboardingStepTemplate
      step={5}
      totalSteps={ONBOARDING_STEP_COUNT}
      footer={
        <>
          <Button label="Turn on notifications" onPress={turnOn} loading={asking} disabled={!values} />
          <Button variant="link" label="Not now" onPress={next} />
        </>
      }>
      <ThemedText type="title" accessibilityRole="header" className="mb-2 mt-7">
        Stay ahead of your money
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary" className="mb-5">
        Pick what you'd like a heads-up about. You can change these any time.
      </ThemedText>
      {me && values && (
        <NotificationPreferences
          options={notificationOptions(me.settings)}
          values={values}
          onChange={(key, value) => setValues({ ...values, [key]: value })}
        />
      )}
    </OnboardingStepTemplate>
  );
}

