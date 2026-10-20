import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { IconCircle } from '@/components/molecules';
import { SyncIllustration, SyncProgress } from '@/components/organisms';
import { OnboardingStepTemplate } from '@/components/templates';
import { useInitialScan } from '@/hooks/use-initial-scan';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { startInitialScan } from '@/services/sms';

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
      <View className="mt-11 h-[180px] items-center justify-center">
        {done ? <IconCircle icon="check" size={140} /> : <SyncIllustration />}
      </View>
      <ThemedText
        type="headline"
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
        className="mb-[18px] mt-9 text-center tracking-[-0.5px]">
        {title}
      </ThemedText>
      {empty ? (
        <ThemedText type="bodySmall" themeColor="textSecondary" className="text-center">
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
            <ThemedText type="callout" themeColor="textSecondary" className="mt-4 text-center">
              You can leave this screen; we'll keep going.
            </ThemedText>
          )}
        </>
      )}
    </OnboardingStepTemplate>
  );
}

