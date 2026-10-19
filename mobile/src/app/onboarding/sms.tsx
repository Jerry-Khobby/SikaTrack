import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { BulletPoint } from '@/components/molecules';
import { SmsInboxPreview } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { updateMe } from '@/services/me';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { requestSmsPermission } from '@/services/permissions';
import { joinWithAnd } from '@/utils/text';

/** S07 · Read your MoMo SMS: ask for READ_SMS and say exactly what happens. */
export default function SmsPermissionScreen() {
  const router = useRouter();
  const config = useAppConfig();
  const [asking, setAsking] = useState(false);

  const senders = (config?.momoSenders ?? []).map((sender) => ({
    name: sender,
    providerCode:
      config?.providers.find((provider) => provider.senders.includes(sender))?.code ?? sender,
  }));

  const allow = async () => {
    setAsking(true);
    const result = await requestSmsPermission();
    await updateMe({ onboarding: { smsPermission: result } });
    setAsking(false);
    router.push(result === 'granted' ? '/onboarding/wallets' : '/onboarding/sms-denied');
  };

  const notNow = async () => {
    await updateMe({ onboarding: { smsPermission: 'denied' } });
    router.push('/onboarding/sms-denied');
  };

  return (
    <OnboardingStepTemplate
      step={2}
      totalSteps={ONBOARDING_STEP_COUNT}
      footer={
        <>
          <Button label="Allow access" onPress={allow} loading={asking} disabled={!config} />
          <Button variant="link" label="Not now" onPress={notNow} />
        </>
      }>
      <View style={styles.preview}>
        <SmsInboxPreview senders={senders} />
      </View>
      <ThemedText type="headline" accessibilityRole="header" style={styles.title}>
        Let SikaTrack read your MoMo SMS
      </ThemedText>
      <View style={styles.points}>
        {config && (
          <BulletPoint
            icon="check"
            text={`We only read messages from ${joinWithAnd(config.momoSenders)}.`}
          />
        )}
        <BulletPoint icon="lock" text="Your other messages never leave your phone." />
        <BulletPoint
          icon="shield"
          text="We read them to build your transactions; nobody reads them by hand."
        />
      </View>
    </OnboardingStepTemplate>
  );
}

const styles = StyleSheet.create({
  preview: {
    marginTop: 28,
  },
  title: {
    marginTop: 28,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  points: {
    gap: 16,
  },
});
