import type { Transaction } from '@/services/transactions';

import { groupByDay } from './group-by-day';

const NOW = Date.parse('2026-10-20T15:00:00Z');

function txn(id: string, occurredAt: string, changes: Partial<Transaction> = {}): Transaction {
  return {
    id,
    status: 'final',
    occurredAt,
    provider: 'mtn_momo',
    walletId: 'wal_1',
    type: 'merchant',
    direction: 'out',
    amount: '10.00',
    fee: '0.00',
    tax: '0.00',
    totalCost: '0.00',
    balanceAfter: null,
    currency: 'GHS',
    category: { id: 'food', name: 'Food', group: 'spending' },
    categorySource: 'rule',
    counterparty: { id: 'cpt_1', name: 'Papaye', kind: 'merchant' },
    reference: null,
    note: null,
    isOwnTransfer: false,
    recurringId: null,
    flags: [],
    ...changes,
  };
}

describe('groupByDay', () => {
  it('groups by day, newest first, with each day’s money out', () => {
    const sections = groupByDay(
      [
        txn('a', '2026-10-20T09:32:00Z', { amount: '40.00' }),
        txn('b', '2026-10-20T07:05:00Z', { amount: '3.00' }),
        txn('c', '2026-10-19T18:40:00Z', { amount: '150.00' }),
        txn('d', '2026-10-19T12:10:00Z', { amount: '500.00', direction: 'in' }),
      ],
      NOW,
    );

    expect(sections.map((s) => [s.title, s.total, s.data.length])).toEqual([
      ['Today', 'GHS 43.00', 2],
      ['Yesterday', 'GHS 150.00', 2],
    ]);
  });

  it('leaves own transfers out of the day total', () => {
    const [today] = groupByDay(
      [txn('a', '2026-10-20T09:00:00Z', { amount: '80.00', isOwnTransfer: true }), txn('b', '2026-10-20T08:00:00Z')],
      NOW,
    );

    expect(today.total).toBe('GHS 10.00');
  });
});
