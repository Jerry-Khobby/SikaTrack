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
  /** As the backend: the sign-in number at once, any other after its code. */
  verified: boolean;
  createdAt: string;
};

/**
 * Two wallets the store starts with, so any screen opened on its own has data.
 * Signing in empties the store, so onboarding starts with none.
 */
function sampleWallets(): StoredWallet[] {
  const createdAt = new Date().toISOString();
  return [
    { id: 'wal_dev_main', provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'ACCOUNT HOLDER', label: 'Main MoMo', verified: true, createdAt },
    { id: 'wal_dev_savings', provider: 'ghanapay', phoneNumber: '+233205550142', accountName: 'ACCOUNT HOLDER', label: 'Savings wallet', verified: true, createdAt },
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

export async function addStoredWallet(
  input: { provider: string; phone_number: string; account_name: string; label: string | null },
  signInNumber: string | null,
) {
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
    verified: input.phone_number === signInNumber,
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

/** `POST /v1/wallets/{id}/verify`: like the sign-in stand-in, any code but 000000 is right. */
export function verifyStoredWallet(id: string, code: string) {
  const target = wallets.find((wallet) => wallet.id === id);
  if (!target) throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' });
  if (target.verified) throw new ApiError({ status: 409, code: 'conflict', title: 'This wallet is already verified' });
  if (code === '000000') {
    throw new ApiError({ status: 400, code: 'otp_invalid', title: 'The code is wrong or has expired' });
  }
  target.verified = true;
  return target;
}

/** `POST /v1/wallets/{id}/code`: nothing is texted; the answer says when another may be asked for. */
export function storedWalletCode(id: string) {
  const target = wallets.find((wallet) => wallet.id === id);
  if (!target) throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' });
  if (target.verified) throw new ApiError({ status: 409, code: 'conflict', title: 'This wallet is already verified' });
  return { expires_in: 300, resend_after: 60 };
}

export function removeStoredWallet(id: string) {
  if (!wallets.some((wallet) => wallet.id === id)) {
    throw new ApiError({ status: 404, code: 'not_found', title: 'Not found' });
  }
  wallets = wallets.filter((wallet) => wallet.id !== id);
}
