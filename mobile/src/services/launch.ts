import Constants from 'expo-constants';

import { ApiError, usesDevServer } from '@/api/client';
import { loadSession } from '@/api/session';

import { getAppConfig } from './config';
import { getMe } from './me';
import { onboardingRoute, type OnboardingRoute } from './onboarding';

export type LaunchDestination = '/update-required' | '/welcome' | '/home' | OnboardingRoute;

export const PLAY_STORE_URL = 'https://play.google.com/store';

/** `1.2.10` → [1, 2, 10], for comparing versions part by part. */
const parts = (version: string) => version.split('.').map((part) => Number(part) || 0);

/** Whether `version` is older than `minimum`. */
export function isOlderThan(version: string, minimum: string) {
  const a = parts(version);
  const b = parts(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

/**
 * Where S01 goes (docs/ui-spec.md §4): Update required when this version is
 * older than `GET /v1/config → min_app_version`; then, with a saved session,
 * Home or the first onboarding step not done; otherwise Welcome. Set
 * EXPO_PUBLIC_FORCE_UPDATE=true to see the update-required screen.
 */
export async function getLaunchDestination(): Promise<LaunchDestination> {
  if (process.env.EXPO_PUBLIC_FORCE_UPDATE === 'true') return '/update-required';

  try {
    const config = await getAppConfig();
    // Only a known version is compared; an unknown one never locks anyone out.
    const version = Constants.expoConfig?.version;
    if (version && isOlderThan(version, config.minAppVersion)) return '/update-required';
  } catch {
    // Offline or the server away: the version can be checked on the next launch.
  }

  // The dev server's stand-in sign-in starts a new account each time, so every launch starts signed out.
  if (usesDevServer || !(await loadSession())) return '/welcome';

  try {
    return onboardingRoute(await getMe(), false) ?? '/home';
  } catch (error) {
    // The session was refused (it ended, or the account was deleted): sign in again.
    if (error instanceof ApiError && error.status === 401) return '/welcome';
    // No answer: open Home, which shows what's saved and the offline or "taking a break" state.
    return '/home';
  }
}
