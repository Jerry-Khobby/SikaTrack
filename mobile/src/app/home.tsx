import { useRouter } from 'expo-router';

import { Button } from '@/components/atoms';
import { MessageTemplate } from '@/components/templates';

/** Placeholder where onboarding lands until Home (S12) is built. */
export default function HomePlaceholderScreen() {
  const router = useRouter();

  return (
    <MessageTemplate
      icon="pie-chart"
      title="Home comes next"
      message="You've been through sign-in and onboarding. The dashboard is the next part to build."
      action={<Button label="Start again" onPress={() => router.replace('/welcome')} />}
    />
  );
}
