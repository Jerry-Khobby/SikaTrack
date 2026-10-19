import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';

/** Goes back, or to `fallback` when the screen was opened with nothing behind it (e.g. a deep link). */
export function useGoBack(fallback: Href) {
  const router = useRouter();

  return useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback);
    }
  }, [router, fallback]);
}
