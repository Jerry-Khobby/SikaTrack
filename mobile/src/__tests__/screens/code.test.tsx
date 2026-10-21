import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import CodeScreen from '@/app/sign-in/code';
import { OtpInvalidError, verifyOtp } from '@/services/auth';
import { renderWithQuery } from '@/test-utils';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
  canDismiss: jest.fn(() => false),
  dismissAll: jest.fn(),
};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({
    phoneNumber: '+233241234567',
    otpRequestId: 'req-1',
    expiresIn: '300',
    resendAfter: '60',
  }),
}));

jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  verifyOtp: jest.fn(),
  requestOtp: jest.fn(),
}));

const mockVerifyOtp = jest.mocked(verifyOtp);

beforeEach(() => jest.clearAllMocks());

async function enterCode(code: string) {
  await fireEvent.changeText(screen.getByLabelText('6-digit code'), code);
}

describe('S05 · Enter the code', () => {
  it('shows where the code went, when it can be resent and when it expires', async () => {
    await renderWithQuery(<CodeScreen />);

    expect(screen.getByText(/Sent to \+233 24 123 4567/)).toBeOnTheScreen();
    expect(screen.getByText('1:00')).toBeOnTheScreen();
    expect(screen.getByText('The code expires in 5 minutes.')).toBeOnTheScreen();
  });

  it('goes back to change the number', async () => {
    await renderWithQuery(<CodeScreen />);

    await fireEvent.press(screen.getByRole('link', { name: 'Change' }));

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('does not submit before the last digit', async () => {
    await renderWithQuery(<CodeScreen />);

    await enterCode('12345');

    expect(mockVerifyOtp).not.toHaveBeenCalled();
  });

  it('submits on the last digit and starts a new user on onboarding', async () => {
    mockVerifyOtp.mockResolvedValue({ isNewUser: true, onboardingFinished: false });
    await renderWithQuery(<CodeScreen />);

    await enterCode('123456');

    expect(mockVerifyOtp).toHaveBeenCalledWith('req-1', '123456');
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/name'));
  });

  it('clears the boxes and explains a wrong code', async () => {
    mockVerifyOtp.mockRejectedValue(new OtpInvalidError());
    await renderWithQuery(<CodeScreen />);

    await enterCode('000000');

    expect(await screen.findByText('That code is wrong or has expired.')).toBeOnTheScreen();
    expect(screen.getByLabelText('6-digit code')).toHaveDisplayValue('');
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('locks the code after five wrong tries', async () => {
    mockVerifyOtp.mockRejectedValue(new OtpInvalidError());
    await renderWithQuery(<CodeScreen />);

    for (let attempt = 1; attempt <= 4; attempt++) {
      await enterCode('000000');
      await screen.findByText('That code is wrong or has expired.');
    }
    await enterCode('000000');

    expect(await screen.findByText('Request a new code.')).toBeOnTheScreen();
    expect(screen.getByLabelText('6-digit code')).not.toBeEnabled();
  });
});
