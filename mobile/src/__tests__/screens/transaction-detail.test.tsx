import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import TransactionDetailScreen from '@/app/transactions/[id]';
import { getDataset } from '@/api/dev-server/dataset';
import { startSession } from '@/services/me';
import { getTransaction } from '@/services/transactions';
import { renderWithQuery, resetDevServer } from '@/test-utils';

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
});

/** A transaction from the dev dataset that matches. */
async function pick(match: (t: Awaited<ReturnType<typeof getDataset>>['transactions'][number]) => boolean) {
  const { transactions } = await getDataset();
  const found = transactions.find(match)!;
  mockParams = { id: found.id };
  return found;
}

describe('S15 · Transaction detail', () => {
  it('shows the amount, who, the category with its reason, and the details', async () => {
    const t = await pick((t) => t.type === 'merchant' && t.direction === 'out' && t.status === 'final');
    await renderWithQuery(<TransactionDetailScreen />);

    expect(await screen.findByText(`-GHS ${t.amount}`)).toBeOnTheScreen();
    expect(screen.getByText('Confirmed')).toBeOnTheScreen();
    expect(screen.getByText(t.category.name)).toBeOnTheScreen();
    expect(screen.getByText(t.category_explanation!)).toBeOnTheScreen();
    expect(screen.getByLabelText('Type: Merchant payment')).toBeOnTheScreen();
  });

  it('changes the category and says you set it', async () => {
    const t = await pick((t) => t.category.id === 'food');
    await renderWithQuery(<TransactionDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Change category, now Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Shopping' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('You set this')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Change category, now Shopping' })).toBeOnTheScreen();
    expect((await getTransaction(t.id)).category.id).toBe('shopping');
  });

  it('saves a note when the field is left', async () => {
    const t = await pick(() => true);
    await renderWithQuery(<TransactionDetailScreen />);

    const field = await screen.findByLabelText('Note');
    await fireEvent.changeText(field, 'Lunch with team');
    await fireEvent(field, 'blur');

    await waitFor(async () => expect((await getTransaction(t.id)).note).toBe('Lunch with team'));
  });

  it('copies the transaction ID', async () => {
    const t = await pick((t) => Boolean(t.provider_txn_id));
    await renderWithQuery(<TransactionDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Copy transaction ID' }));

    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(t.provider_txn_id);
    expect(await screen.findByText('Copied')).toBeOnTheScreen();
  });

  it('explains flags and shows the original SMS', async () => {
    const t = await pick((t) => t.flags.includes('duplicate_sms_merged'));
    await renderWithQuery(<TransactionDetailScreen />);

    expect(await screen.findByText('You received this SMS twice; we counted it once.')).toBeOnTheScreen();
    expect(screen.getByText('2 SMS')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /View the SMS/ }));
    expect(screen.getByText(t.sms_text)).toBeOnTheScreen();
  });

  it('opens every payment to the same counterparty', async () => {
    const t = await pick(() => true);
    await renderWithQuery(<TransactionDetailScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: `See all payments to ${t.counterparty.name}` }));

    expect(mockRouter.navigate).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: { counterpartyId: t.counterparty.id, counterpartyName: t.counterparty.name },
    });
  });
});
