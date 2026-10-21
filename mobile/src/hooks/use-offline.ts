import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** True while the phone has no connection (G1), for the "You're offline" banner. */
export function useOffline() {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => !onlineManager.isOnline(),
  );
}
