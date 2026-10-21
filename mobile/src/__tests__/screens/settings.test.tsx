import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { onlineManager } from '@tanstack/react-query';

import MoreScreen from '@/app/(tabs)/more';
import AccountDeletedScreen from '@/app/account-deleted';
import DeleteAccountScreen from '@/app/delete-account';
import LowBalanceScreen from '@/app/low-balance';
import NotificationSettingsScreen from '@/app/notification-settings';
import ProfileScreen from '@/app/profile';
import SyncScreen from '@/app/sync';
import { reportSystemEvent } from '@/api/system-events';
import { SystemStates } from '@/components/organisms';
import { getMe, startSession, updateMe } from '@/services/me';
import { renderWithQuery, resetDevServer } from '@/test-utils';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  resetDevServer();
  startSession('+233241234567');
  await updateMe({ displayName: 'Jerry' });
});

describe('S25 · More', () => {
  it('opens every built screen from its row', async () => {
    await renderWithQuery(<MoreScreen />);

    const rows: [RegExp, string][] = [
      [/^Profile: Jerry/, '/profile'],
      [/^Notifications$/, '/notification-settings'],
      [/^Low-balance alert, GHS 5\.00$/, '/low-balance'],
      [/^Sync status/, '/sync'],
      [/^How we handle your data$/, '/privacy'],
      [/^Delete account$/, '/delete-account'],
    ];
    for (const [name, route] of rows) {
      await fireEvent.press(await screen.findByRole('button', { name }));
      expect(mockRouter.push).toHaveBeenLastCalledWith(route);
    }
  });

  it('shows the sync state next to its row', async () => {
    await renderWithQuery(<MoreScreen />);
    expect(await screen.findByRole('button', { name: /^Sync status, (Up to date|\d+ processing|Delayed)$/ })).toBeOnTheScreen();
  });
});

describe('S33 · Profile', () => {
  it('saves a new display name and shows what the account holds', async () => {
    await renderWithQuery(<ProfileScreen />);

    expect(await screen.findByText(/^Member since /)).toBeOnTheScreen();
    expect(screen.getByText(/^[\d,]+ transactions$/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Phone number, \+233 24 123 4567/)).toBeOnTheScreen();

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await fireEvent.changeText(screen.getByDisplayValue('Jerry'), 'Jerry K');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await getMe()).displayName).toBe('Jerry K');
  });
});

describe('S31 · Notification settings', () => {
  it('says Android notifications are on and saves each switch at once', async () => {
    await renderWithQuery(<NotificationSettingsScreen />);

    expect(await screen.findByText('Android notifications are on')).toBeOnTheScreen();
    await fireEvent(await screen.findByRole('switch', { name: 'New data ready' }), 'valueChange', true);
    await waitFor(async () => expect((await getMe()).settings.notify.dataReady).toBe(true));
  });
});

describe('S32 · Low-balance alert', () => {
  it('steps the amount, previews last month, and saves', async () => {
    await renderWithQuery(<LowBalanceScreen />);

    expect(await screen.findByLabelText('GHS 5.00')).toBeOnTheScreen();
    expect(await screen.findByText(/^You'd have been alerted on \d+ days? in /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Increase by GHS 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Increase by GHS 1' }));
    expect(screen.getByLabelText('GHS 7.00')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(mockRouter.back).toHaveBeenCalled());
    expect((await getMe()).settings.lowBalanceThreshold).toBe('7.00');
  });

  it("won't go below GHS 1", async () => {
    await updateMe({ settings: { lowBalanceThreshold: '1.00' } });
    await renderWithQuery(<LowBalanceScreen />);
    expect(await screen.findByRole('button', { name: 'Decrease by GHS 1' })).toBeDisabled();
  });
});

describe('S34 · Sync status', () => {
  it('shows the state, the details and the SMS permission, and syncs on request', async () => {
    await renderWithQuery(<SyncScreen />);

    expect(await screen.findByRole('header', { name: /^(Up to date|Processing \d+ (payments?|messages?)|Taking longer than usual)$/ })).toBeOnTheScreen();
    expect(screen.getByText('Last processing run')).toBeOnTheScreen();
    expect(screen.getByText('Allowed')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
    expect(await screen.findByText(/^No new MoMo SMS/)).toBeOnTheScreen();
  });

  it('offers to turn SMS access on when it’s off', async () => {
    await updateMe({ onboarding: { smsPermission: 'denied' } });
    await renderWithQuery(<SyncScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'SMS permission is off. Turn on' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sms');
  });
});

describe('S37 · Delete account', () => {
  it('waits for DELETE, then schedules the deletion', async () => {
    await renderWithQuery(<DeleteAccountScreen />);

    const button = screen.getByRole('button', { name: 'Delete my account' });
    expect(button).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/account-deleted', params: { until: expect.any(String) } }),
    );
  });

  it('S37b names the day it goes for good', async () => {
    mockParams = { until: '2026-10-28T10:00:00.000Z' };
    await renderWithQuery(<AccountDeletedScreen />);
    expect(screen.getByText('Your account will be deleted on 28 Oct 2026')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/welcome');
  });
});

describe('Global states', () => {
  const props = { onUpdateRequired: jest.fn(), onCodeSent: jest.fn(), onUseAnotherNumber: jest.fn() };

  it('G1 shows the offline banner on every templated screen', async () => {
    await renderWithQuery(<MoreScreen />);
    expect(screen.queryByText("You're offline · showing saved data")).not.toBeOnTheScreen();
    await act(() => onlineManager.setOnline(false));
    expect(screen.getByText("You're offline · showing saved data")).toBeOnTheScreen();
    await act(() => onlineManager.setOnline(true));
  });

  it('G2 asks to sign in again and texts a code to the last number', async () => {
    await renderWithQuery(
      <>
        <MoreScreen />
        <SystemStates {...props} />
      </>,
    );
    await screen.findByText('Jerry');
    await act(() => reportSystemEvent({ type: 'session_expired' }));

    expect(screen.getByText('Please sign in again')).toBeOnTheScreen();
    expect(screen.getByText(/We'll text a new code to \+233 24 123 4567\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(props.onCodeSent).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: '+233241234567' })));
  });

  it('G4 says to slow down, G5 says the servers are away, G6 opens the update screen', async () => {
    await renderWithQuery(<SystemStates {...props} />);

    await act(() => reportSystemEvent({ type: 'rate_limited', retryAfter: 30 }));
    expect(screen.getByText('Slow down a little. Try again in 30 seconds.')).toBeOnTheScreen();

    await act(() => reportSystemEvent({ type: 'unavailable' }));
    expect(screen.getByText('SikaTrack is taking a break')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep using saved data' }));
    expect(screen.queryByText('SikaTrack is taking a break')).not.toBeOnTheScreen();

    await act(() => reportSystemEvent({ type: 'update_required' }));
    expect(props.onUpdateRequired).toHaveBeenCalled();
  });
});
