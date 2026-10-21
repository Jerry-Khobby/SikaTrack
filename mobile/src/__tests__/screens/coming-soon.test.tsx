import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import BudgetsScreen from '@/app/(tabs)/budgets';
import MoreScreen from '@/app/(tabs)/more';
import ExportScreen from '@/app/export';
import NotFoundScreen from '@/app/+not-found';
import { redirectSystemPath } from '@/app/+native-intent';
import WalletsOnboardingScreen from '@/app/onboarding/wallets';
import ProviderComingSoonScreen from '@/app/providers/[code]';
import PhoneScreen from '@/app/sign-in/phone';
import TermsScreen from '@/app/terms';
import * as config from '@/services/config';
import { startSession } from '@/services/me';
import { renderWithQuery, resetDevServer } from '@/test-utils';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
  mockParams = {};
  resetDevServer();
  startSession('+233241234567');
});

/** The dev config with export switched on, as the server will send once it's built. */
async function withExport(on: boolean) {
  const real = await config.getAppConfig();
  jest.spyOn(config, 'getAppConfig').mockResolvedValue({ ...real, features: { ...real.features, export: on } });
}

describe('Export my data', () => {
  it('is reachable from More, marked coming soon while export is off', async () => {
    await renderWithQuery(<MoreScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Export my data, Coming soon' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/export');
  });

  it('explains the export and waits while it isn’t available', async () => {
    await renderWithQuery(<ExportScreen />);
    expect(await screen.findByText('Your transactions')).toBeOnTheScreen();
    expect(screen.getByText(/Export isn't ready yet/)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Coming soon' })).toBeDisabled();
  });

  it('asks for the export once the server turns it on', async () => {
    await withExport(true);
    await renderWithQuery(<ExportScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Request my export' }));
    expect(await screen.findByText(/We're preparing your export/)).toBeOnTheScreen();
  });
});

describe('Providers coming soon', () => {
  it('S08 opens what "Coming soon" means for an unsupported provider', async () => {
    await renderWithQuery(<WalletsOnboardingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Telecel Cash, coming soon. Learn more' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/providers/[code]', params: { code: 'telecel_cash' } });
  });

  it('names the provider and what still works', async () => {
    mockParams = { code: 'telecel_cash' };
    await renderWithQuery(<ProviderComingSoonScreen />);
    expect(await screen.findByText('Telecel Cash is coming soon')).toBeOnTheScreen();
    expect(screen.getByText('Add your MTN MoMo and GhanaPay wallets now. They work fully today.')).toBeOnTheScreen();
  });
});

describe('Terms', () => {
  it('opens from the phone-number screen and links to privacy', async () => {
    await renderWithQuery(<PhoneScreen />);
    await fireEvent.press(await screen.findByText('Terms'));
    expect(mockRouter.push).toHaveBeenCalledWith('/terms');

    await renderWithQuery(<TermsScreen />);
    expect(screen.getByText('What SikaTrack is')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('How we handle your data'));
    expect(mockRouter.push).toHaveBeenCalledWith('/privacy');
  });
});

describe('Links from outside the app', () => {
  it('translates the backend’s link names into screens', () => {
    expect(redirectSystemPath({ path: 'sikatrack://balances', initial: true })).toBe('/wallets');
    expect(redirectSystemPath({ path: 'sikatrack://budgets/food', initial: false })).toBe('/budgets?highlight=food');
    expect(redirectSystemPath({ path: 'sikatrack://somewhere-new', initial: false })).toBe('sikatrack://somewhere-new');
  });

  it('a budget link picks out that budget', async () => {
    mockParams = { highlight: 'food' };
    await renderWithQuery(<BudgetsScreen />);
    expect(await screen.findByRole('button', { name: /^Food budget/ })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Transport budget/ })).not.toBeSelected();
  });

  it('an unknown page offers the way home', async () => {
    await renderWithQuery(<NotFoundScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Go to Home' }));
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/home'));
  });
});
