import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import PhoneScreen from '@/app/sign-in/phone';
import { RateLimitedError, requestOtp } from '@/services/auth';

const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  canGoBack: jest.fn(() => true),
};

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

jest.mock('@/services/auth', () => ({
  ...jest.requireActual('@/services/auth'),
  requestOtp: jest.fn(),
}));

const mockRequestOtp = jest.mocked(requestOtp);

beforeEach(() => jest.clearAllMocks());

async function renderScreen() {
  await render(<PhoneScreen />);
  return screen.findByLabelText('Phone number');
}

describe('S04 · Phone number', () => {
  it('starts on the first supported country with Send code off', async () => {
    await renderScreen();

    expect(screen.getByText('+233')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
  });

  it('formats the number as it is typed and turns Send code on once it is valid', async () => {
    const field = await renderScreen();

    await fireEvent.changeText(field, '0241234567');

    expect(field).toHaveDisplayValue('024 123 4567');
    expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled();
  });

  it('asks for a code and moves on to the code screen', async () => {
    mockRequestOtp.mockResolvedValue({ otpRequestId: 'req-1', expiresIn: 300, resendAfter: 60 });
    const field = await renderScreen();

    await fireEvent.changeText(field, '0241234567');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/sign-in/code',
        params: {
          phoneNumber: '+233241234567',
          otpRequestId: 'req-1',
          expiresIn: '300',
          resendAfter: '60',
        },
      }),
    );
    expect(mockRequestOtp).toHaveBeenCalledWith('+233241234567');
  });

  it('says how long to wait when too many codes were asked for', async () => {
    mockRequestOtp.mockRejectedValue(new RateLimitedError(8));
    const field = await renderScreen();

    await fireEvent.changeText(field, '0241234567');
    await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText('Too many codes. Try again in 8 minutes.')).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('lets people pick another country but explains it is not available yet', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Change country/ }));
    await fireEvent.changeText(screen.getByLabelText('Search by country or code'), 'nigeria');
    await fireEvent.press(screen.getByRole('button', { name: 'Nigeria, +234' }));

    expect(screen.getByText('+234')).toBeOnTheScreen();
    expect(screen.getByText(/SikaTrack isn't available in Nigeria yet/)).toBeOnTheScreen();
    expect(screen.getByText(/only read the ones from Ghana/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Phone number')).not.toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send code' })).toBeDisabled();
  });

  it('opens the privacy page from the Privacy Policy link', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('link', { name: 'Privacy Policy' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/privacy');
  });
});
