import { useRouter } from 'expo-router';

import { Button } from '@/components/atoms';
import { MessageTemplate } from '@/components/templates';

/** Placeholder where sign-in lands until onboarding (S06 onwards) is built. */
export default function OnboardingPlaceholderScreen() {
  const router = useRouter();

  return (
    <MessageTemplate
      icon="user"
      title="You're signed in"
      message="Onboarding comes next. For now, you can run through sign-in again."
      action={<Button label="Start again" onPress={() => router.replace('/welcome')} />}
    />
  );
}
