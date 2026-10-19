import { getMe, startSession, updateMe } from './me';
import { onboardingRoute } from './onboarding';

beforeEach(() => startSession('+233241234567'));

describe('onboardingRoute', () => {
  it('starts a new user at the name step', async () => {
    expect(onboardingRoute(await getMe(), true)).toBe('/onboarding/name');
  });

  it('resumes a returning user at the first step not done yet', async () => {
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/sms');

    await updateMe({ onboarding: { smsPermission: 'denied' } });
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/wallets');

    await updateMe({ onboarding: { walletsAdded: true } });
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/sync');
  });

  it('is finished once the first sync is done', async () => {
    await updateMe({
      onboarding: { smsPermission: 'granted', walletsAdded: true, firstSyncDone: true },
    });
    expect(onboardingRoute(await getMe(), false)).toBeNull();
  });
});
