import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { Logo } from '@/components/molecules';
import { SplashTemplate } from '@/components/templates';
import { getLaunchDestination } from '@/services/launch';

/** Long enough to see the brand, short enough to stay under the spec's one second. */
const MIN_SPLASH_MS = 800;

/** S01 · Launch */
export default function LaunchScreen() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const minimumDelay = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));

    Promise.all([getLaunchDestination(), minimumDelay]).then(([destination]) => {
      if (!cancelled) {
        router.replace(destination);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <SplashTemplate footer="Made in Ghana">
      <Logo variant="splash" />
    </SplashTemplate>
  );
}
