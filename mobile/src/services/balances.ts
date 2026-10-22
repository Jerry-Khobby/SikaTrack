import { api } from '@/api/client';
import type { ApiBalanceHistory, ApiBalances, ApiWallet } from '@/api/types';
import { toIsoDate, today } from '@/utils/dates';
import { toPesewas } from '@/utils/money';

import { getMe } from './me';

export type AccountWallet = {
  id: string;
  provider: string;
  label: string | null;
  phoneNumber: string;
};

export type WalletBalance = AccountWallet & {
  balance: string;
  asOf: string;
  /** Below the user's low-balance alert amount. */
  isLow: boolean;
};

export type Balances = { total: string; currency: string; wallets: WalletBalance[] };

const toAccountWallet = (w: ApiWallet): AccountWallet => ({
  id: w.id,
  provider: w.provider,
  label: w.label,
  phoneNumber: w.phone_number,
});

/** `GET /v1/wallets`: the user's wallets, for labels and the wallet filter. */
export async function listAccountWallets() {
  const response = await api.get<{ items: ApiWallet[] }>('/v1/wallets');
  return response.items.map(toAccountWallet);
}

/** `GET /v1/balances`, with each wallet's label and whether it's running low. */
export async function getBalances(): Promise<Balances> {
  const [balances, wallets, me] = await Promise.all([
    api.get<ApiBalances>('/v1/balances'),
    listAccountWallets(),
    getMe(),
  ]);
  const threshold = toPesewas(me.settings.lowBalanceThreshold);
  return {
    total: balances.total,
    currency: me.settings.currency,
    wallets: balances.items.map((item) => {
      // A balance from an SMS not matched to a wallet yet is keyed by its provider.
      const id = item.wallet_id ?? item.provider;
      const wallet = wallets.find((w) => w.id === id);
      return {
        id,
        provider: item.provider,
        label: wallet?.label ?? null,
        phoneNumber: wallet?.phoneNumber ?? '',
        balance: item.balance,
        asOf: item.as_of,
        isLow: toPesewas(item.balance) < threshold,
      };
    }),
  };
}

export type HistoryRange = '1M' | '3M' | '6M';

export const HISTORY_RANGES: HistoryRange[] = ['1M', '3M', '6M'];

export type BalanceHistory = {
  from: string;
  to: string;
  /** One line per wallet: its end-of-day balance, oldest first. */
  series: { walletId: string; points: { date: string; balance: string }[] }[];
  /** Days this month any wallet ended below the alert amount. */
  daysBelowThreshold: number;
  threshold: string;
};

const RANGE_DAYS: Record<HistoryRange, number> = { '1M': 30, '3M': 91, '6M': 182 };

/** `GET /v1/balances/history?from=&to=`, grouped into one line per wallet. */
export async function getBalanceHistory(range: HistoryRange, now = Date.now()): Promise<BalanceHistory> {
  const from = toIsoDate(now - (RANGE_DAYS[range] - 1) * 24 * 60 * 60 * 1000);
  const to = today(now);
  const response = await api.get<ApiBalanceHistory>('/v1/balances/history', { from, to });
  const byWallet = new Map<string, { date: string; balance: string }[]>();
  for (const item of response.items) {
    const key = item.wallet_id ?? 'unmatched';
    byWallet.set(key, [...(byWallet.get(key) ?? []), { date: item.date, balance: item.balance }]);
  }
  return {
    from,
    to,
    series: [...byWallet.entries()].map(([walletId, points]) => ({
      walletId,
      points: points.sort((a, b) => a.date.localeCompare(b.date)),
    })),
    daysBelowThreshold: response.days_below_threshold,
    threshold: response.threshold,
  };
}

/**
 * On how many days between `from` and `to` any wallet ended below `threshold`
 * (`GET /v1/balances/history`): S32's "You'd have been alerted on 3 days last month".
 */
export async function daysBelow(threshold: string, range: { from: string; to: string }) {
  const response = await api.get<ApiBalanceHistory>('/v1/balances/history', range);
  const limit = toPesewas(threshold);
  return new Set(response.items.filter((item) => toPesewas(item.balance) < limit).map((item) => item.date)).size;
}
