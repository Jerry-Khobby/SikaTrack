import { api } from '@/api/client';
import type { ApiBalances, ApiWallet } from '@/api/types';
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
      const wallet = wallets.find((w) => w.id === item.wallet_id);
      return {
        id: item.wallet_id,
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
