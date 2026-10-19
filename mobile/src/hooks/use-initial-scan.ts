import { useSyncExternalStore } from 'react';

import { getScanState, subscribeToScan } from '@/services/sms';

/** The first sync's live progress. */
export function useInitialScan() {
  return useSyncExternalStore(subscribeToScan, getScanState);
}
