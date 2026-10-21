import { fireEvent, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/welcome';
import { renderWithQuery } from '@/test-utils';

const mockRouter = { push: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => jest.clearAllMocks());

describe('S03 · Welcome', () => {
  it('names the supported providers from the server config', async () => {
    await renderWithQuery(<WelcomeScreen />);

    expect(await screen.findByText('Works with MTN MoMo and GhanaPay.')).toBeOnTheScreen();
    expect(screen.queryByText(/Telecel Cash/)).toBeNull();
  });

  it('starts sign-in from Get started', async () => {
    await renderWithQuery(<WelcomeScreen />);
    await screen.findByText(/Works with/);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in/phone');
  });

  it('opens the privacy page', async () => {
    await renderWithQuery(<WelcomeScreen />);
    await screen.findByText(/Works with/);

    await fireEvent.press(screen.getByRole('button', { name: 'How we handle your data' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/privacy');
  });
});
