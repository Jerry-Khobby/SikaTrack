import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import TransactionsScreen from '@/app/(tabs)/transactions';
import { startSession } from '@/services/me';
import { DEFAULT_FILTERS, listTransactions } from '@/services/transactions';
import { renderWithQuery, resetDevServer } from '@/test-utils';

const mockRouter = { push: jest.fn(), navigate: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  resetDevServer();
  startSession('+233241234567');
});

describe('S13 · Transactions', () => {
  it('lists the last 30 days, newest first, and opens a payment', async () => {
    const { items } = await listTransactions(DEFAULT_FILTERS);
    await renderWithQuery(<TransactionsScreen />);

    const rows = await screen.findAllByRole('button', { name: new RegExp(`^${items[0].counterparty.name},`) });
    await fireEvent.press(rows[0]);

    expect(mockRouter.push).toHaveBeenCalledWith(`/transactions/${items[0].id}`);
  });

  it('searches after a short pause, and says when nothing matches', async () => {
    await renderWithQuery(<TransactionsScreen />);
    await screen.findAllByRole('button', { name: /GHS/ });

    await fireEvent.changeText(screen.getByLabelText('Search people, shops, references'), 'zzzz');

    expect(await screen.findByText('Nothing matches these filters', {}, { timeout: 3000 })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(screen.queryByText('Nothing matches these filters')).toBeNull(), { timeout: 3000 });
  });

  it('opens filtered to one counterparty from a transaction', async () => {
    mockParams = { counterpartyId: 'cpt_dev_mum', counterpartyName: 'Mum' };
    await renderWithQuery(<TransactionsScreen />);

    expect(await screen.findByRole('button', { name: 'Clear Mum' })).toBeOnTheScreen();
    await waitFor(() => {
      const rows = screen.queryAllByRole('button', { name: /GHS/ });
      expect(rows.every((row) => /^Mum,/.test(row.props.accessibilityLabel))).toBe(true);
    });
  });

  it('opens the filters sheet from a chip and applies it', async () => {
    await renderWithQuery(<TransactionsScreen />);
    await screen.findAllByRole('button', { name: /GHS/ });

    await fireEvent.press(screen.getByRole('button', { name: 'Out / In' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Money in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Show results' }));

    expect(await screen.findByRole('button', { name: 'Money in' })).toBeSelected();
    await waitFor(() => {
      const rows = screen.queryAllByRole('button', { name: /GHS/ });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => /\+GHS/.test(row.props.accessibilityLabel))).toBe(true);
    });
  });

  it('shows an error with the request ID', async () => {
    process.env.EXPO_PUBLIC_DEV_API_FAILURE = 'true';
    try {
      await renderWithQuery(<TransactionsScreen />);
      expect(await screen.findByText("We couldn't load your transactions")).toBeOnTheScreen();
      expect(screen.getByText(/^Ref: /)).toBeOnTheScreen();
    } finally {
      delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
    }
  });
});
