import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import BudgetsScreen from '@/app/(tabs)/budgets';
import MoreScreen from '@/app/(tabs)/more';
import RecurringDetailScreen from '@/app/recurring/[id]';
import RecurringScreen from '@/app/recurring/index';
import WalletsScreen from '@/app/wallets';
import { deleteBudget, listBudgets } from '@/services/budgets';
import { startSession, updateMe } from '@/services/me';
import { getRecurringSeries } from '@/services/recurring';
import { listWallets } from '@/services/wallets';
import { renderWithQuery, resetDevServer } from '@/test-utils';
import { currentMonth } from '@/utils/dates';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(async () => {
  jest.clearAllMocks();
  resetDevServer();
  startSession('+233241234567');
  await updateMe({ displayName: 'Jerry' });
});

describe('S23 · Budgets', () => {
  it('shows the month summary and a card per budget', async () => {
    await renderWithQuery(<BudgetsScreen />);

    expect(await screen.findByText('Spent so far')).toBeOnTheScreen();
    for (const budget of await listBudgets(currentMonth())) {
      expect(screen.getByRole('button', { name: new RegExp(`^${budget.category.name} budget`) })).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: 'New budget' })).toBeOnTheScreen();
  });

  it('creates a budget from the S24 sheet', async () => {
    await renderWithQuery(<BudgetsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'New budget' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Shopping' }));
    await fireEvent.changeText(screen.getByLabelText('Monthly limit'), '350');
    await fireEvent.press(screen.getByRole('button', { name: 'Save budget' }));

    expect(await screen.findByRole('button', { name: /^Shopping budget/ })).toBeOnTheScreen();
    expect((await listBudgets(currentMonth())).find((b) => b.category.id === 'shopping')?.limit).toBe('350.00');
  });

  it('marks categories that already have a budget', async () => {
    await renderWithQuery(<BudgetsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'New budget' }));
    expect(screen.getByRole('radio', { name: 'Food, has a budget' })).toBeOnTheScreen();
  });

  it('deletes a budget after asking', async () => {
    await renderWithQuery(<BudgetsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Food budget/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete budget' }));
    expect(screen.getByText('Delete the Food budget?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: /^Food budget/ })).not.toBeOnTheScreen());
    expect((await listBudgets(currentMonth())).some((b) => b.category.id === 'food')).toBe(false);
  });

  it('invites you to make one when there are none', async () => {
    for (const budget of await listBudgets(currentMonth())) {
      await deleteBudget(budget.category.id);
    }
    await renderWithQuery(<BudgetsScreen />);

    expect(await screen.findByText('Budgets keep you on track')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'New budget' })).not.toBeOnTheScreen();
  });
});

describe('S25 · More', () => {
  it('shows who is signed in and opens wallets and recurring', async () => {
    await renderWithQuery(<MoreScreen />);

    expect(await screen.findByText('Jerry')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Wallets and balances' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/wallets');
    await fireEvent.press(screen.getByRole('button', { name: 'Recurring payments' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/recurring');
  });

  it('marks export as coming soon but still opens its screen', async () => {
    await renderWithQuery(<MoreScreen />);

    const row = await screen.findByRole('button', { name: 'Export my data, Coming soon' });
    expect(row).toBeEnabled();
    await fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith('/export');
  });

  it('signs out after asking', async () => {
    await renderWithQuery(<MoreScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Sign out of SikaTrack on this phone?')).toBeOnTheScreen();
    const buttons = screen.getAllByRole('button', { name: 'Sign out' });
    await fireEvent.press(buttons[buttons.length - 1]);
    expect(mockRouter.replace).toHaveBeenCalledWith('/welcome');
  });
});

describe('S26 · Wallets', () => {
  it('lists each wallet with its balance and the history', async () => {
    await renderWithQuery(<WalletsScreen />);

    expect(await screen.findByRole('button', { name: 'Options for Main MoMo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Options for Savings wallet' })).toBeOnTheScreen();
    expect(await screen.findByText('Total balance')).toBeOnTheScreen();
    expect(await screen.findByText(/days? below GHS 5\.00 this month/)).toBeOnTheScreen();
  });

  it('relabels a wallet from its menu', async () => {
    await renderWithQuery(<WalletsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Options for Main MoMo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Edit wallet' }));
    const label = await screen.findByDisplayValue('Main MoMo');
    await fireEvent.changeText(label, 'Daily wallet');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Options for Daily wallet' })).toBeOnTheScreen();
  });

  it('removes a wallet after asking', async () => {
    await renderWithQuery(<WalletsScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Options for Savings wallet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remove wallet' }));
    expect(screen.getByText(/Transfers to this number will count as spending again/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Remove' }));

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Options for Savings wallet' })).not.toBeOnTheScreen(),
    );
    expect((await listWallets()).map((w) => w.label)).toEqual(['Main MoMo']);
  });
});

describe('S28 · Recurring', () => {
  it('shows the monthly cost, asks about new ones, and filters by status', async () => {
    await renderWithQuery(<RecurringScreen />);

    expect(await screen.findByText(/a month$/)).toBeOnTheScreen();
    expect(screen.getByText('Review this')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^DStv Compact/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Netflix.*still charging/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^Boomplay/ })).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'Stopped' }));
    expect(screen.getByRole('button', { name: /^Boomplay Premium.*stopped/ })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /^DStv Compact/ })).not.toBeOnTheScreen();
  });

  it('confirms a series from the review card', async () => {
    await renderWithQuery(<RecurringScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Yes, Kwesi Ofori is expected' }));

    await waitFor(() => expect(screen.queryByText('Review this')).not.toBeOnTheScreen());
    expect((await getRecurringSeries('rec_dev_kwesi')).userState).toBe('expected');
  });

  it('opens a series', async () => {
    await renderWithQuery(<RecurringScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^DStv Compact/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/recurring/rec_dev_dstv');
  });
});

describe('S29 · Recurring detail', () => {
  it('warns when a payment you meant to cancel is still charging', async () => {
    mockParams = { id: 'rec_dev_netflix' };
    await renderWithQuery(<RecurringDetailScreen />);

    expect(await screen.findByText('Netflix')).toBeOnTheScreen();
    expect(screen.getByText('Still charging')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: /^I plan to cancel/ })).toBeChecked();
  });

  it('changes the decision and lists the payments', async () => {
    mockParams = { id: 'rec_dev_dstv' };
    await renderWithQuery(<RecurringDetailScreen />);

    await fireEvent.press(await screen.findByRole('radio', { name: /^I plan to cancel/ }));
    await waitFor(async () => expect((await getRecurringSeries('rec_dev_dstv')).userState).toBe('cancel_planned'));

    const history = await screen.findByText('Payment history');
    expect(history).toBeOnTheScreen();
    const payments = screen.getAllByRole('button', { name: /^GHS 120\.00 on / });
    await fireEvent.press(payments[0]);
    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/transactions\//));
  });

  it('renames a series', async () => {
    mockParams = { id: 'rec_dev_kwesi' };
    await renderWithQuery(<RecurringDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Rename/ }));
    const field = screen.getByLabelText('What is this payment for?');
    await fireEvent.changeText(field, 'Rent share');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Rent share')).toBeOnTheScreen();
  });
});
