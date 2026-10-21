import { useLocalSearchParams, useRouter } from 'expo-router';

import { Button } from '@/components/atoms';
import { MessageTemplate } from '@/components/templates';
import { formatFullDate } from '@/utils/dates';

/** S37b · Deletion scheduled: when the account goes for good, and how to keep it. */
export default function AccountDeletedScreen() {
  const router = useRouter();
  const { until } = useLocalSearchParams<{ until?: string }>();

  return (
    <MessageTemplate
      icon="calendar"
      title={until ? `Your account will be deleted on ${formatFullDate(until)}` : 'Your account will be deleted in 7 days'}
      message="You've been signed out everywhere. Sign in again before then and everything comes back as it was."
      action={<Button label="Done" onPress={() => router.replace('/welcome')} />}
    />
  );
}
