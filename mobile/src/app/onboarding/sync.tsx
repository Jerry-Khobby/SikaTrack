import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';
import { SyncIllustration, SyncProgress } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useInitialScan } from '@/hooks/use-initial-scan';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { startInitialScan } from '@/services/sms';
import { Spacing } from '@/theme';

/** S09 · First sync: read the MoMo SMS history once and show it turning into transactions. */
export default function FirstSyncScreen() {
  const router = useRouter();
  const scan = useInitialScan();
  const done = scan.status === 'done';
  const empty = done && scan.total === 0;

  useEffect(() => {
    startInitialScan();
  }, []);

  const title = empty
    ? 'No MoMo messages yet'
    : done
      ? 'Done! Your first transactions are ready.'
      : 'Reading your MoMo history…';

  return (
    <OnboardingStepTemplate
      step={4}
      totalSteps={ONBOARDING_STEP_COUNT}
      footer={
        <Button
          variant={done ? 'primary' : 'secondary'}
          label={done ? 'Continue' : 'Continue in the background'}
          onPress={() => router.push('/onboarding/notifications')}
        />
      }>
      <View style={styles.illustration}>
        {done ? <IconCircle icon="check" size={140} /> : <SyncIllustration />}
      </View>
      <ThemedText
        type="headline"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        style={styles.title}>
        {title}
      </ThemedText>
      {empty ? (
        <ThemedText type="bodySmall" themeColor="textSecondary" style={styles.center}>
          We didn't find any MoMo messages on this phone. New ones will appear as they arrive.
        </ThemedText>
      ) : (
        <>
          <SyncProgress
            found={scan.found}
            parsed={scan.parsed}
            ignored={scan.ignored}
            total={scan.total}
            done={done}
          />
          {!done && (
            <ThemedText type="callout" themeColor="textSecondary" style={styles.leave}>
              You can leave this screen; we'll keep going.
            </ThemedText>
          )}
        </>
      )}
    </OnboardingStepTemplate>
  );
}

const styles = StyleSheet.create({
  illustration: {
    marginTop: 44,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: 36,
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  center: {
    textAlign: 'center',
  },
  leave: {
    marginTop: Spacing.three,
    textAlign: 'center',
  },
});
