import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Transaction } from '@/services/transactions';

import { TransactionRow } from './transaction-row';

const base: Transaction = {
  id: 'txn_1',
  status: 'final',
  occurredAt: '2026-10-20T09:32:00Z',
  provider: 'mtn_momo',
  walletId: 'wal_1',
  type: 'merchant',
  direction: 'out',
  amount: '40.00',
  fee: '0.00',
  tax: '0.00',
  totalCost: '0.00',
  balanceAfter: '26.14',
  currency: 'GHS',
  category: { id: 'personal_care', name: 'Personal Care', group: 'spending' },
  categorySource: 'rule',
  counterparty: { id: 'cpt_1', name: 'Sunshine Laundry', kind: 'merchant' },
  reference: null,
  note: null,
  isOwnTransfer: false,
  recurringId: null,
  flags: [],
};

async function renderRow(changes: Partial<Transaction> = {}, onPress = jest.fn()) {
  await render(
    <TransactionRow transaction={{ ...base, ...changes }} providerName="MTN MoMo" timeLabel="09:32" onPress={onPress} />,
  );
  return onPress;
}

describe('TransactionRow', () => {
  it('shows who, what, when and how much', async () => {
    await renderRow();

    expect(screen.getByText('Sunshine Laundry')).toBeOnTheScreen();
    expect(screen.getByText('Personal Care · 09:32')).toBeOnTheScreen();
    expect(screen.getByText('GHS 40.00')).toBeOnTheScreen();
    expect(screen.queryByText(/fee/)).toBeNull();
  });

  it('puts + on money in and shows the fee when there is one', async () => {
    await renderRow({ direction: 'in', amount: '500.00' });
    expect(screen.getByText('+GHS 500.00')).toBeOnTheScreen();

    await renderRow({ fee: '1.50' });
    expect(screen.getByText('fee 1.50')).toBeOnTheScreen();
  });

  it('marks provisional payments and possible missing SMS', async () => {
    await renderRow({ status: 'provisional', flags: ['balance_gap'] });

    expect(screen.getByText('Processing')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /processing, an SMS may be missing/ })).toBeOnTheScreen();
  });

  it('opens the transaction when pressed', async () => {
    const onPress = await renderRow();

    await fireEvent.press(screen.getByRole('button', { name: /Sunshine Laundry/ }));

    expect(onPress).toHaveBeenCalled();
  });
});
