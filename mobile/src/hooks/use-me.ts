import { useQuery } from '@tanstack/react-query';

import { getMe } from '@/services/me';

export const meQueryKey = ['me'] as const;

/**
 * The signed-in user, or undefined while it loads. Shared through the query
 * cache, and checked again whenever a screen opens, so a change saved on one
 * screen (a name, a setting) shows on the next.
 */
export function useMe() {
  return useQuery({ queryKey: meQueryKey, queryFn: getMe, staleTime: 0 }).data;
}
