export type LaunchDestination = '/update-required' | '/welcome';

export const PLAY_STORE_URL = 'https://play.google.com/store';

/**
 * Decides where S01 goes (docs/ui-spec.md §4). Until `GET /v1/config` and
 * `GET /v1/me` exist, every launch is an up-to-date app with nobody signed in.
 * Set EXPO_PUBLIC_FORCE_UPDATE=true to see the update-required screen.
 */
export async function getLaunchDestination(): Promise<LaunchDestination> {
  if (process.env.EXPO_PUBLIC_FORCE_UPDATE === 'true') {
    return '/update-required';
  }
  return '/welcome';
}
