import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './errors';

/** Errors worth retrying: no answer, or the server's own trouble (5xx). */
function shouldRetry(failureCount: number, error: unknown) {
  if (failureCount >= 2) return false;
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}

/** The X-Request-ID of a failed call, shown on error screens as "Ref: …". */
export function requestIdOf(error: unknown) {
  return error instanceof ApiError ? error.requestId : undefined;
}
