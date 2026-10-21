import { routeForLink } from '@/utils/deep-links';

/**
 * Links that open the app from outside it, e.g. tapping a push notification
 * with `sikatrack://balances`. The backend's link names aren't all route names
 * (`balances` is `/wallets`), so they go through the same table the in-app
 * notification and insight taps use. Anything else is passed on as it is.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return routeForLink(path) ?? path;
  } catch {
    return path;
  }
}
