import { api } from '@/api/client';
import { getBalanceHistory, getBalances } from '@/services/balances';
import { deleteAccount, getMe, startSession, updateMe } from '@/services/me';
import { OtpInvalidError } from '@/services/auth';
import { addWallet, resetWallets, sendWalletCode, verifyWallet } from '@/services/wallets';
import { resetDevServer } from '@/test-utils';

import { ApiError } from '../errors';

beforeEach(() => {
  resetDevServer();
  startSession('+233241234567');
});

describe('dev server: /v1/me', () => {
  it('describes the new account and the data it holds', async () => {
    const me = await getMe();
    expect(me.phoneNumber).toBe('+233241234567');
    expect(me.displayName).toBeNull();
    expect(Date.parse(me.createdAt)).not.toBeNaN();
    expect(me.settings.lowBalanceThreshold).toBe('5.00');
    expect(me.data.transactions).toBeGreaterThan(0);
    expect(me.data.firstTransactionAt! < me.data.lastTransactionAt!).toBe(true);
  });

  it('saves the name, a notification switch and the low-balance amount', async () => {
    await updateMe({ displayName: 'Jerry', settings: { notify: { dataReady: true }, lowBalanceThreshold: '20.00' } });
    const me = await getMe();
    expect(me.displayName).toBe('Jerry');
    expect(me.settings.notify.dataReady).toBe(true);
    expect(me.settings.notify.budgets).toBe(true);
    expect(me.settings.lowBalanceThreshold).toBe('20.00');
  });

  it('refuses a low-balance amount that isn’t money above zero', async () => {
    for (const amount of ['0', '-5', 'five']) {
      await expect(updateMe({ settings: { lowBalanceThreshold: amount } })).rejects.toMatchObject({ code: 'validation_error' });
    }
  });

  it('judges low balances against the user’s amount', async () => {
    const before = await getBalances();
    await updateMe({ settings: { lowBalanceThreshold: '100000.00' } });
    const after = await getBalances();
    expect(after.wallets.every((w) => w.isLow)).toBe(true);
    expect(after.wallets.filter((w) => w.isLow).length).toBeGreaterThanOrEqual(before.wallets.filter((w) => w.isLow).length);
    expect((await getBalanceHistory('1M')).threshold).toBe('100000.00');
  });

  it('schedules the deletion seven days out', async () => {
    const now = Date.now();
    const until = Date.parse(await deleteAccount());
    expect(until - now).toBeGreaterThan(6.9 * 24 * 3600 * 1000);
    expect(until - now).toBeLessThan(7.1 * 24 * 3600 * 1000);
  });
});

describe('dev server: onboarding, as the backend records it', () => {
  it('reports SMS access as not asked until the app says', async () => {
    expect((await getMe()).onboarding.smsPermission).toBeNull();
    await updateMe({ onboarding: { smsPermission: 'denied' } });
    expect((await getMe()).onboarding.smsPermission).toBe('denied');
  });

  it('marks wallets added when a wallet is added, and the first sync done on the first upload', async () => {
    resetWallets(); // a new account: no wallets yet
    expect((await getMe()).onboarding).toMatchObject({ walletsAdded: false, firstSyncDone: false });
    // The sign-in number: verified at once
    const wallet = await addWallet({ provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'AMA SERWAA', label: null });
    expect(wallet.verified).toBe(true);
    expect((await getMe()).onboarding.walletsAdded).toBe(true);
    await api.post('/v1/sms/batches', { source: 'initial_scan', messages: [] });
    expect((await getMe()).onboarding.firstSyncDone).toBe(true);
  });

  it('needs the code texted to a wallet on another number before it counts', async () => {
    const wallet = await addWallet({ provider: 'mtn_momo', phoneNumber: '+233245550000', accountName: 'AMA SERWAA', label: null });
    expect(wallet.verified).toBe(false);
    expect((await getMe()).onboarding.walletsAdded).toBe(false);

    expect(await sendWalletCode(wallet.id)).toEqual({ expiresIn: 300, resendAfter: 60 });
    await expect(verifyWallet(wallet.id, '000000')).rejects.toBeInstanceOf(OtpInvalidError);
    expect((await verifyWallet(wallet.id, '482913')).verified).toBe(true);
    expect((await getMe()).onboarding.walletsAdded).toBe(true);
  });

  it('sends the account’s currency with its settings', async () => {
    expect((await getMe()).settings.currency).toBe('GHS');
  });
});

describe('dev server: failure modes', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
  });

  it.each([
    ['unavailable', 503, 'dependency_unavailable'],
    ['rate_limited', 429, 'rate_limited'],
    ['session_expired', 401, 'refresh_invalid'],
    ['update_required', 426, 'app_update_required'],
    ['true', 500, 'unexpected_error'],
  ])('EXPO_PUBLIC_DEV_API_FAILURE=%s answers %s %s', async (mode, status, code) => {
    process.env.EXPO_PUBLIC_DEV_API_FAILURE = mode;
    const error = await getMe().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code });
  });
});
