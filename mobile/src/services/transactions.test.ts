import { closestToLimit, type Budget } from './budgets';
import { syncMessage } from './sync';
import {
  DEFAULT_FILTERS,
  countActiveFilters,
  filtersToQuery,
  hasActiveFilters,
} from './transactions';

const NOW = Date.parse('2026-10-20T15:00:00Z');

describe('filtersToQuery', () => {
  it('sends the last 30 days and nothing else by default', () => {
    expect(filtersToQuery(DEFAULT_FILTERS, NOW)).toEqual({
      from: '2026-09-21',
      to: '2026-10-20',
      direction: null,
      category: undefined,
      wallet_id: null,
      counterparty_id: undefined,
      min_amount: null,
      max_amount: null,
      include_own_transfers: undefined,
      q: undefined,
    });
  });

  it('maps every filter to its query parameter', () => {
    const query = filtersToQuery(
      {
        date: { from: '2026-01-01', to: '2026-03-31' },
        direction: 'out',
        categories: ['food', 'bills'],
        walletId: 'wal_1',
        minAmount: '10',
        maxAmount: '200.50',
        includeOwnTransfers: true,
        counterparty: { id: 'cpt_1', name: 'Mum' },
        q: '  ya ',
      },
      NOW,
    );
    expect(query).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
      direction: 'out',
      category: ['food', 'bills'],
      wallet_id: 'wal_1',
      counterparty_id: 'cpt_1',
      min_amount: '10',
      max_amount: '200.50',
      include_own_transfers: true,
      q: 'ya',
    });
  });

  it('only searches from two letters', () => {
    expect(filtersToQuery({ ...DEFAULT_FILTERS, q: 'y' }, NOW).q).toBeUndefined();
  });
});

describe('active filters', () => {
  it('counts what differs from the defaults', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, direction: 'in', categories: ['food'] })).toBe(2);
  });

  it('treats a search or another date range as filtering', () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: 'mum' })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, date: { preset: 'this_year' } })).toBe(true);
  });
});

describe('syncMessage', () => {
  const idle = { pendingMessages: 0, provisionalTransactions: 0, lastRunFailed: false, dataThrough: null };

  it('says nothing when all is well', () => {
    expect(syncMessage(idle)).toBeNull();
  });

  it('puts uploads first, then processing, then a failed run', () => {
    expect(syncMessage({ ...idle, pendingMessages: 12, provisionalTransactions: 3 })).toBe('Syncing 12 new messages…');
    expect(syncMessage({ ...idle, provisionalTransactions: 1 })).toBe('1 recent payment is still processing');
    expect(syncMessage({ ...idle, provisionalTransactions: 3 })).toBe('3 recent payments are still processing');
    expect(syncMessage({ ...idle, lastRunFailed: true })).toBe('Some payments are taking longer than usual');
  });
});

describe('closestToLimit', () => {
  it('picks the budgets nearest their limit', () => {
    const budget = (id: string, used: string) => ({ id, used }) as Budget;
    expect(closestToLimit([budget('a', '0.2'), budget('b', '1.12'), budget('c', '0.875')]).map((b) => b.id)).toEqual(['b', 'c']);
  });
});
