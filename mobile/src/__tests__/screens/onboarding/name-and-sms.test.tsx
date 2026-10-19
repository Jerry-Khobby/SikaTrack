import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import NameScreen from '@/app/onboarding/name';
import SmsDeniedScreen from '@/app/onboarding/sms-denied';
import SmsPermissionScreen from '@/app/onboarding/sms';
import { getMe, startSession } from '@/services/me';
import { openAppSettings, requestSmsPermission } from '@/services/permissions';

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/services/permissions', () => ({
  requestSmsPermission: jest.fn(),
  openAppSettings: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  jest.clearAllMocks();
  startSession('+233241234567');
});

describe('S06 · Your name', () => {
  it('shows it is step 1 of 5', async () => {
    await render(<NameScreen />);

    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();
  });

  it('saves the name and moves on to SMS access', async () => {
    await render(<NameScreen />);

    await fireEvent.changeText(screen.getByLabelText('Your first name'), '  Jerry ');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sms'));
    expect((await getMe()).displayName).toBe('Jerry');
  });

  it('can be skipped without a name', async () => {
    await render(<NameScreen />);

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Skip' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sms');
    expect((await getMe()).displayName).toBeNull();
  });
});

describe('S07 · Read your MoMo SMS', () => {
  it('names the senders it reads, from the server config', async () => {
    await render(<SmsPermissionScreen />);

    expect(
      await screen.findByText('We only read messages from MobileMoney and GhanaPay.'),
    ).toBeOnTheScreen();
  });

  it('goes on to wallets once access is granted', async () => {
    jest.mocked(requestSmsPermission).mockResolvedValue('granted');
    await render(<SmsPermissionScreen />);
    await screen.findByText(/We only read messages/);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow access' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/wallets'));
    expect((await getMe()).onboarding.smsPermission).toBe('granted');
  });

  it('explains why it is needed when access is refused', async () => {
    jest.mocked(requestSmsPermission).mockResolvedValue('denied');
    await render(<SmsPermissionScreen />);
    await screen.findByText(/We only read messages/);

    await fireEvent.press(screen.getByRole('button', { name: 'Allow access' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sms-denied'));
  });

  it('records "not now" as denied', async () => {
    await render(<SmsPermissionScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sms-denied'));
    expect((await getMe()).onboarding.smsPermission).toBe('denied');
  });
});

describe('S07 · SMS access denied', () => {
  it('opens Android settings, then carries on', async () => {
    await render(<SmsDeniedScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));

    expect(openAppSettings).toHaveBeenCalled();
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/wallets'));
  });

  it('lets people carry on without it', async () => {
    await render(<SmsDeniedScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Maybe later' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/wallets');
  });
});
