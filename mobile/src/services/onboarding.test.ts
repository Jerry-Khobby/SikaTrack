import { api } from '@/api/client';
import { resetDevServer } from '@/test-utils';

import { getMe, startSession, updateMe } from './me';
import { addWallet, resetWallets } from './wallets';
import { onboardingRoute } from './onboarding';

beforeEach(() => {
  resetDevServer();
  startSession('+233241234567');
  resetWallets(); // a new account: no wallets yet
});

describe('onboardingRoute', () => {
  it('starts a new user at the name step', async () => {
    expect(onboardingRoute(await getMe(), true)).toBe('/onboarding/name');
  });

  it('resumes a returning user at the first step not done yet', async () => {
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/sms');

    await updateMe({ onboarding: { smsPermission: 'denied' } });
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/wallets');

    // A wallet on another number doesn't finish the step until its code is entered...
    await addWallet({ provider: 'mtn_momo', phoneNumber: '+233245550000', accountName: 'AMA SERWAA', label: null });
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/wallets');

    // ...the server records it itself when a verified wallet is added (the sign-in number is).
    await addWallet({ provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'AMA SERWAA', label: null });
    expect(onboardingRoute(await getMe(), false)).toBe('/onboarding/sync');
  });

  it('is finished once the first sync is done', async () => {
    await updateMe({ onboarding: { smsPermission: 'granted' } });
    await addWallet({ provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'AMA SERWAA', label: null });
    // ...and this one when the first scan is uploaded.
    await api.post('/v1/sms/batches', { source: 'initial_scan', messages: [] });
    expect(onboardingRoute(await getMe(), false)).toBeNull();
  });
});
