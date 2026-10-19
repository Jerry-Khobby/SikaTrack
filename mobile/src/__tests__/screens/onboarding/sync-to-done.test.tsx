import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AllSetScreen from '@/app/onboarding/done';
import NotificationsScreen from '@/app/onboarding/notifications';
import FirstSyncScreen from '@/app/onboarding/sync';
import { getMe, startSession, updateMe } from '@/services/me';
import { requestNotificationPermission } from '@/services/permissions';
import { getScanState, resetScan, startInitialScan } from '@/services/sms';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  canDismiss: jest.fn(() => true),
  dismissAll: jest.fn(),
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/services/permissions', () => ({
  requestNotificationPermission: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  startSession('+233241234567');
  resetScan();
});

afterEach(() => {
  resetScan();
  jest.useRealTimers();
});

describe('S09 · First sync', () => {
  it('shows live counts, lets people leave, then says when it is done', async () => {
    jest.useFakeTimers();
    await render(<FirstSyncScreen />);

    expect(screen.getByText('Reading your MoMo history…')).toBeOnTheScreen();
    expect(screen.getByText("You can leave this screen; we'll keep going.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Continue in the background' })).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(7000);
    });

    expect(screen.getByText('Done! Your first transactions are ready.')).toBeOnTheScreen();
    expect(screen.getByText('Transactions')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/notifications');
  });

  it('says so when the phone has no MoMo SMS', async () => {
    const original = process.env.EXPO_PUBLIC_EMPTY_INBOX;
    process.env.EXPO_PUBLIC_EMPTY_INBOX = 'true';
    await render(<FirstSyncScreen />);

    expect(await screen.findByText('No MoMo messages yet')).toBeOnTheScreen();
    process.env.EXPO_PUBLIC_EMPTY_INBOX = original;
  });
});

describe('S10 · Notifications', () => {
  it('starts from the account settings, with the low-balance amount in them', async () => {
    await render(<NotificationsScreen />);

    expect(await screen.findByText('When a wallet drops below GHS 5.00.')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Budget alerts' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'New data ready' })).not.toBeChecked();
  });

  it('saves the choices once notifications are allowed', async () => {
    jest.mocked(requestNotificationPermission).mockResolvedValue('granted');
    await render(<NotificationsScreen />);
    await screen.findByRole('switch', { name: 'Weekly summary' });

    await fireEvent.press(screen.getByRole('switch', { name: 'Weekly summary' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Turn on notifications' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/done'));
    expect((await getMe()).settings.notify.weeklySummary).toBe(false);
  });

  it('can be skipped', async () => {
    await render(<NotificationsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/done');
    expect(requestNotificationPermission).not.toHaveBeenCalled();
  });
});

describe('S11 · All set', () => {
  beforeEach(() => jest.useFakeTimers());

  it('greets by name with a teaser from the first sync', async () => {
    await updateMe({ displayName: 'Jerry' });
    startInitialScan();
    jest.advanceTimersByTime(7000);
    const { parsed } = getScanState();

    await render(<AllSetScreen />);

    expect(await screen.findByText("You're all set, Jerry")).toBeOnTheScreen();
    expect(
      screen.getByText(`We found ${parsed.toLocaleString('en-US')} transactions since Nov 2025.`),
    ).toBeOnTheScreen();
  });

  it('says the sync is still going when it is', async () => {
    startInitialScan();

    await render(<AllSetScreen />);

    expect(await screen.findByText("You're all set")).toBeOnTheScreen();
    expect(screen.getByText(/still reading your messages/)).toBeOnTheScreen();
  });

  it('goes to the dashboard and clears onboarding from the history', async () => {
    await render(<AllSetScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Go to my dashboard' }));

    expect(mockRouter.dismissAll).toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/home');
  });
});
