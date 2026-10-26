import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import WalletsScreen from '@/app/onboarding/wallets';
import { getMe, startSession } from '@/services/me';
import { resetWallets } from '@/services/wallets';
import { renderWithQuery } from '@/test-utils';

const mockRouter = { push: jest.fn() };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useFocusEffect: (effect: () => void) => require('react').useEffect(effect, [effect]),
}));

beforeEach(() => {
  jest.clearAllMocks();
  startSession('+233241234567');
  resetWallets();
});

async function renderScreen() {
  await renderWithQuery(<WalletsScreen />);
  await screen.findByRole('button', { name: 'Add MTN MoMo' });
}

async function addMomoWallet(accountName = 'JERRY K MENSAH') {
  await fireEvent.press(screen.getByRole('button', { name: 'Add MTN MoMo' }));
  await fireEvent.changeText(screen.getByLabelText('Name on the account'), accountName);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

describe('S08 · Add your wallets', () => {
  it('lists the providers from the server config, unsupported ones greyed out', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Add GhanaPay' })).toBeOnTheScreen();
    expect(screen.getByText('Telecel Cash')).toBeOnTheScreen();
    expect(screen.getByText('Coming soon')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add Telecel Cash' })).toBeNull();
  });

  it('keeps Continue off until a wallet is added', async () => {
    await renderScreen();

    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  });

  it('prefills the first wallet with the sign-in number', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Add MTN MoMo' }));

    expect(screen.getByLabelText('Phone number')).toHaveDisplayValue('024 123 4567');
  });

  it('adds a wallet, lists it, and moves on to the first sync', async () => {
    await renderScreen();

    await addMomoWallet();

    expect(await screen.findByText('024 123 4567 · JERRY K MENSAH')).toBeOnTheScreen();
    expect(screen.getByText('Your wallets')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/onboarding/sync'));
    expect((await getMe()).onboarding.walletsAdded).toBe(true);
  });

  it('asks for the code texted to a wallet on another number, and keeps Continue off until then', async () => {
    await renderScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Add MTN MoMo' }));
    await fireEvent.changeText(screen.getByLabelText('Phone number'), '0245550000');
    await fireEvent.changeText(screen.getByLabelText('Name on the account'), 'JERRY K MENSAH');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('024 555 0000 · Not confirmed: tap to enter the code')).toBeOnTheScreen();
    await waitFor(() =>
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/verify-wallet/[id]',
        params: { id: expect.any(String), phoneNumber: '+233245550000' },
      }),
    );
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    expect((await getMe()).onboarding.walletsAdded).toBe(false);
  });

  it('says so when the wallet is already on the account', async () => {
    await renderScreen();
    await addMomoWallet();
    await screen.findByText('024 123 4567 · JERRY K MENSAH');

    await fireEvent.press(screen.getByRole('button', { name: 'Add MTN MoMo' }));
    await fireEvent.changeText(screen.getByLabelText('Phone number'), '0241234567');
    await fireEvent.changeText(screen.getByLabelText('Name on the account'), 'JERRY K MENSAH');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('This wallet is already on your account.')).toBeOnTheScreen();
  });

  it('edits a wallet from its edit button', async () => {
    await renderScreen();
    await addMomoWallet();
    await screen.findByText('024 123 4567 · JERRY K MENSAH');

    await fireEvent.press(screen.getByRole('button', { name: 'Edit MTN MoMo' }));
    await fireEvent.changeText(screen.getByLabelText('Label'), 'Main MoMo');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Main MoMo')).toBeOnTheScreen();
  });
});
