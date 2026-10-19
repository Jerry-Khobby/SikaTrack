import type { Me } from './me';

/** The steps in the progress bar across S06–S10. */
export const ONBOARDING_STEP_COUNT = 5;

export type OnboardingRoute = '/onboarding/name' | '/onboarding/sms' | '/onboarding/wallets' | '/onboarding/sync';

/**
 * Where onboarding starts or picks up again (docs/ui-spec.md S01 and S05), or
 * null when it's finished. Steps save as they go, so a returning user resumes
 * at the first one not done yet.
 */
export function onboardingRoute(me: Me, isNewUser: boolean): OnboardingRoute | null {
  if (isNewUser) return '/onboarding/name';
  if (!me.onboarding.smsPermission) return '/onboarding/sms';
  if (!me.onboarding.walletsAdded) return '/onboarding/wallets';
  if (!me.onboarding.firstSyncDone) return '/onboarding/sync';
  return null;
}
