import { useRouter } from 'expo-router';

import { Button } from '@/components/atoms';
import { MessageTemplate } from '@/components/templates';

/** A link to a page the app doesn't have, e.g. from a newer version's notification. */
export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <MessageTemplate
      icon="search"
      title="This page isn't here"
      message="The link may be from a newer version of SikaTrack. Everything else is where you left it."
      action={<Button label="Go to Home" onPress={() => router.replace('/home')} />}
    />
  );
}
