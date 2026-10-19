import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';
import { OnboardingStepTemplate } from '@/components/templates';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { openAppSettings } from '@/services/permissions';

/** S07 · SMS access denied. Calm, with a way to turn it on, and a way past it. */
export default function SmsDeniedScreen() {
  const router = useRouter();
  const next = () => router.push('/onboarding/wallets');

  const openSettings = async () => {
    await openAppSettings();
    next();
  };

  return (
    <OnboardingStepTemplate
      step={2}
      totalSteps={ONBOARDING_STEP_COUNT}
      centered
      footer={
        <>
          <Button label="Open settings" onPress={openSettings} />
          <Button variant="link" label="Maybe later" onPress={next} />
        </>
      }>
      <IconCircle icon="message-dash" tone="neutral" size={120} />
      <ThemedText type="headline" accessibilityRole="header" style={styles.center}>
        SikaTrack needs this to work
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary" style={[styles.center, styles.message]}>
        Without your MoMo SMS there's nothing to build your transactions from. You can turn access
        on in Android settings whenever you're ready.
      </ThemedText>
    </OnboardingStepTemplate>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  message: {
    maxWidth: 300,
  },
});
