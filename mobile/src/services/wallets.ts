import { ApiError, api } from '@/api/client';
import { resetWalletStore } from '@/api/dev-server/wallet-store';
import type { ApiWallet } from '@/api/types';

export type Wallet = {
  id: string;
  provider: string;
  /** E.164, e.g. `+233241234567`. */
  phoneNumber: string;
  /** Exactly as it appears on the MoMo SMS, e.g. `JERRY K MENSAH`. */
  accountName: string;
  label: string | null;
};

export type NewWallet = Omit<Wallet, 'id'>;

export type WalletChanges = Partial<Pick<Wallet, 'accountName' | 'label'>>;

/** `conflict`: this wallet is already on the account. */
export class WalletConflictError extends Error {
  constructor() {
    super('conflict');
  }
}

/** `unsupported_provider`: SikaTrack can't read this provider's SMS yet. */
export class UnsupportedProviderError extends Error {
  constructor() {
    super('unsupported_provider');
  }
}

const toWallet = (w: ApiWallet): Wallet => ({
  id: w.id,
  provider: w.provider,
  phoneNumber: w.phone_number,
  accountName: w.account_name,
  label: w.label,
});

/** Turns the API's wallet errors into the two the screens explain. */
function walletError(error: unknown) {
  if (error instanceof ApiError && error.code === 'conflict') return new WalletConflictError();
  if (error instanceof ApiError && error.code === 'unsupported_provider') return new UnsupportedProviderError();
  return error;
}

/** Empties the dev server's wallets; the sign-in stand-in calls it for a fresh account. */
export function resetWallets() {
  resetWalletStore();
}

/** `GET /v1/wallets` */
export async function listWallets() {
  const response = await api.get<{ items: ApiWallet[] }>('/v1/wallets');
  return response.items.map(toWallet);
}

/** `POST /v1/wallets` */
export async function addWallet(input: NewWallet) {
  try {
    return toWallet(
      await api.post<ApiWallet>('/v1/wallets', {
        provider: input.provider,
        phone_number: input.phoneNumber,
        account_name: input.accountName,
        label: input.label,
      }),
    );
  } catch (error) {
    throw walletError(error);
  }
}

/** `PATCH /v1/wallets/{id}`: only the account name and the label can change. */
export async function updateWallet(id: string, changes: WalletChanges) {
  return toWallet(
    await api.patch<ApiWallet>(`/v1/wallets/${id}`, {
      ...(changes.label !== undefined && { label: changes.label }),
      ...(changes.accountName !== undefined && { account_name: changes.accountName }),
    }),
  );
}

/** `DELETE /v1/wallets/{id}`. Its past transactions stay. */
export async function removeWallet(id: string) {
  await api.delete<void>(`/v1/wallets/${id}`);
}

/**
 * Account-holder names found in the phone's MoMo SMS, offered as "Is this you?"
 * chips. They come from reading the SMS on the phone, which needs a development
 * build, so there are none yet.
 */
export async function getAccountNameSuggestions(): Promise<string[]> {
  return [];
}
