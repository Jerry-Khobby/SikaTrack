import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { resetDataset } from '@/api/dev-server/dataset';
import { resetDevInbox } from '@/api/dev-server';

/** A fresh query cache per test, with no retries so errors show at once. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
}

/** Renders a screen or organism that reads data through TanStack Query. */
export function renderWithQuery(ui: ReactElement, client = createTestQueryClient()) {
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

/** Starts the dev server's sample data and inbox over. */
export function resetDevServer() {
  resetDataset();
  resetDevInbox();
}
