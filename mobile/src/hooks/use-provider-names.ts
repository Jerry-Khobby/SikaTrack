import { useMemo } from 'react';

import { useAppConfig } from './use-app-config';

/** Provider code → display name (`mtn_momo` → `MTN MoMo`), from the server config. */
export function useProviderNames() {
  const config = useAppConfig();
  return useMemo(
    () => Object.fromEntries((config?.providers ?? []).map((p) => [p.code, p.name])),
    [config],
  );
}

/** Provider code → the SMS sender it texts from (`mtn_momo` → `MobileMoney`). */
export function useProviderSenders() {
  const config = useAppConfig();
  return useMemo(
    () => Object.fromEntries((config?.providers ?? []).map((p) => [p.code, p.senders[0] ?? null])),
    [config],
  );
}
