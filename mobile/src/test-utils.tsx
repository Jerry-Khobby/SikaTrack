import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { resetDataset } from '@/api/dev-server/dataset';
import { resetDevState } from '@/api/dev-server';
import { restoreSampleWallets } from '@/api/dev-server/wallet-store';

/**
 * A fresh query cache per test, with no retries so errors show at once. Nothing
 * is garbage-collected, so no cache timers keep Jest running after the tests.
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
}

/** Renders a screen or organism that reads data through TanStack Query. */
export function renderWithQuery(ui: ReactElement, client = createTestQueryClient()) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Starts the dev server over: sample wallets and data, inbox, budgets and recurring decisions. */
export function resetDevServer() {
  resetDataset();
  resetDevState();
  restoreSampleWallets();
}
