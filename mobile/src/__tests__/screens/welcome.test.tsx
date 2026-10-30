import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import WelcomeScreen from '@/app/welcome';
import { renderWithQuery } from '@/test-utils';

const mockRouter = { push: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('S03 · Welcome', () => {
  it('names the supported providers from the server config', async () => {
    await renderWithQuery(<WelcomeScreen />);

    expect(await screen.findByText('Works with MTN MoMo and GhanaPay.')).toBeOnTheScreen();
    expect(screen.queryByText(/Telecel Cash/)).toBeNull();
  });

  it('signs in with Google and starts onboarding', async () => {
    await renderWithQuery(<WelcomeScreen />);
    await screen.findByText(/Works with/);

    await fireEvent.press(screen.getByRole('button', { name: 'Continue with Google' }));

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding/name'));
  });

  it('offers a phone number instead', async () => {
    await renderWithQuery(<WelcomeScreen />);
    await screen.findByText(/Works with/);

    await fireEvent.press(screen.getByRole('button', { name: 'Use your phone number instead' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in/phone');
  });

  it('opens the privacy page', async () => {
    await renderWithQuery(<WelcomeScreen />);
    await screen.findByText(/Works with/);

    await fireEvent.press(screen.getByRole('button', { name: 'How we handle your data' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/privacy');
  });
});
