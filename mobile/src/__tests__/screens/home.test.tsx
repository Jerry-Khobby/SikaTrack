import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/home';
import { startSession, updateMe } from '@/services/me';
import { listNotifications } from '@/services/notifications';
import { getMonthSummary } from '@/services/summary';
import { listRecentTransactions } from '@/services/transactions';
import { renderWithQuery, resetDevServer } from '@/test-utils';
import { currentMonth, formatMonthLong, formatMonthName, previousMonth } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

beforeEach(() => {
  jest.clearAllMocks();
  resetDevServer();
  startSession('+233241234567');
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_EMPTY_INBOX;
  delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
});

describe('S12 · Home', () => {
  it('greets by name and shows this month’s money out from the summary', async () => {
    await updateMe({ displayName: 'Jerry' });
    const summary = await getMonthSummary(currentMonth());
    await renderWithQuery(<HomeScreen />);

    expect(await screen.findByText(formatMoney(summary.moneyOut, summary.currency))).toBeOnTheScreen();
    expect(screen.getByText(/, Jerry$/)).toBeOnTheScreen();
    expect(screen.getByText('Total balance')).toBeOnTheScreen();
    expect(screen.getByText('Spending by category')).toBeOnTheScreen();
  });

  it('opens the inbox from the bell, with the unread count', async () => {
    const { unread } = await listNotifications();
    await renderWithQuery(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: `Notifications, ${unread} unread` }));

    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
  });

  it('lists the latest payments and opens one', async () => {
    const [latest] = await listRecentTransactions();
    await renderWithQuery(<HomeScreen />);

    const rows = await screen.findAllByRole('button', { name: new RegExp(`^${latest.counterparty.name},`) });
    await fireEvent.press(rows[0]);

    expect(mockRouter.push).toHaveBeenCalledWith(expect.stringMatching(/^\/transactions\/txn_/));
  });

  it('goes to the full list from Recent', async () => {
    await renderWithQuery(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'See all: Recent' }));

    expect(mockRouter.navigate).toHaveBeenCalledWith('/transactions');
  });

  it('switches month from the month chip', async () => {
    const before = previousMonth(currentMonth());
    const summary = await getMonthSummary(before);
    await renderWithQuery(<HomeScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^[A-Z][a-z]{2} \d{4}$/ }));
    await fireEvent.press(screen.getByRole('radio', { name: formatMonthLong(before) }));

    expect(await screen.findByText(formatMoney(summary.moneyOut, summary.currency))).toBeOnTheScreen();
  });

  it('shows an empty month without the cards', async () => {
    process.env.EXPO_PUBLIC_EMPTY_INBOX = 'true';
    await renderWithQuery(<HomeScreen />);

    expect(await screen.findByText(`No spending in ${formatMonthName(currentMonth())} yet`)).toBeOnTheScreen();
    expect(screen.getByText('Nothing to show yet')).toBeOnTheScreen();
    expect(screen.queryByText('Spending by category')).toBeNull();
  });

  it('shows an error with Try again and the request ID', async () => {
    process.env.EXPO_PUBLIC_DEV_API_FAILURE = 'true';
    await renderWithQuery(<HomeScreen />);

    expect(await screen.findByText("We couldn't load your dashboard")).toBeOnTheScreen();
    expect(screen.getByText(/^Ref: /)).toBeOnTheScreen();

    delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Money out this month')).toBeOnTheScreen());
  });
});
