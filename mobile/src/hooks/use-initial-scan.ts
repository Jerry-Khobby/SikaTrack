import { useSyncExternalStore } from 'react';

import { getScanState, subscribeToScan } from '@/services/sms';

/** The first sync's live progress. */
export function useInitialScan() {
  // The third argument is for rendering on a server (the web build); it starts from the same state.
  return useSyncExternalStore(subscribeToScan, getScanState, getScanState);
}
