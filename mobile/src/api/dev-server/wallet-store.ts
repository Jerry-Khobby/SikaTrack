/**
 * The dev server's wallets (`/v1/wallets`), held in memory. The sample
 * transactions are spread over these, so adding, renaming or removing one
 * changes Home, the balances and the transaction list together.
 */
import { ApiError } from '../errors';
import { DEV_CONFIG } from './catalog';

export type StoredWallet = {
  id: string;
  provider: string;
  phoneNumber: string;
  accountName: string;
  label: string | null;
  createdAt: string;
};

/**
 * Two wallets the store starts with, so any screen opened on its own has data.
 * Signing in empties the store, so onboarding starts with none.
 */
function sampleWallets(): StoredWallet[] {
  const createdAt = new Date().toISOString();
  return [
    { id: 'wal_dev_main', provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'ACCOUNT HOLDER', label: 'Main MoMo', createdAt },
    { id: 'wal_dev_savings', provider: 'ghanapay', phoneNumber: '+233205550142', accountName: 'ACCOUNT HOLDER', label: 'Savings wallet', createdAt },
  ];
}

let wallets: StoredWallet[] = sampleWallets();
let nextId = 1;

export function allWallets() {
  return wallets;
}

/** No wallets: a brand-new account. */
export function resetWalletStore() {
  wallets = [];
  nextId = 1;
}

/** Back to the two sample wallets, e.g. between tests. */
export function restoreSampleWallets() {
  wallets = sampleWallets();
  nextId = 1;
}

export async function addStoredWallet(input: { provider: string; phone_number: string; account_name: string; label: string | null }) {
  if (!DEV_CONFIG.providers.some((provider) => provider.code === input.provider && provider.supported)) {
    throw new ApiError({ status: 422, code: 'unsupported_provider', title: "We don't support this provider yet" });
  }
  if (wallets.some((w) => w.provider === input.provider && w.phoneNumber === input.phone_number)) {
    throw new ApiError({ status: 409, code: 'conflict', title: 'This wallet is already on your account' });
  }
  const wallet: StoredWallet = {
    id: `wal_dev_${nextId++}`,
    provider: input.provider,
    phoneNumber: input.phone_number,
    accountName: input.account_name,
    label: input.label,
    createdAt: new Date().toISOString(),
  };
  wallets = [...wallets, wallet];
  return wallet;
}

export function updateStoredWallet(id: string, changes: { label?: string | null; account_name?: string }) {
  const target = wallets.find((wallet) => wallet.id === id);
  if (!target) throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' });
  if (changes.label !== undefined) target.label = changes.label;
  if (changes.account_name !== undefined) target.accountName = changes.account_name;
  return target;
}

export function removeStoredWallet(id: string) {
  if (!wallets.some((wallet) => wallet.id === id)) {
    throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' });
  }
  wallets = wallets.filter((wallet) => wallet.id !== id);
}
