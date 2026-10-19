/**
 * Stand-ins for `/v1/wallets` until the backend is wired in. Held in memory,
 * with the server's two errors: `conflict` and `unsupported_provider`.
 */
import { getAppConfig } from './config';

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

let wallets: Wallet[] = [];
let nextId = 1;

/** Empties the list; the sign-in stand-in calls it for a fresh account. */
export function resetWallets() {
  wallets = [];
  nextId = 1;
}

/** `GET /v1/wallets` */
export async function listWallets() {
  return wallets.map((wallet) => ({ ...wallet }));
}

/** `POST /v1/wallets` */
export async function addWallet(input: NewWallet) {
  const { providers } = await getAppConfig();
  if (!providers.some((provider) => provider.code === input.provider && provider.supported)) {
    throw new UnsupportedProviderError();
  }
  if (wallets.some((w) => w.provider === input.provider && w.phoneNumber === input.phoneNumber)) {
    throw new WalletConflictError();
  }
  const wallet = { id: `wal_dev_${nextId++}`, ...input };
  wallets = [...wallets, wallet];
  return { ...wallet };
}

/** `PATCH /v1/wallets/{id}`: only the account name and the label can change. */
export async function updateWallet(id: string, changes: WalletChanges) {
  wallets = wallets.map((wallet) => (wallet.id === id ? { ...wallet, ...changes } : wallet));
  const updated = wallets.find((wallet) => wallet.id === id);
  if (!updated) throw new Error('not_found');
  return { ...updated };
}

/**
 * Account-holder names found in the phone's MoMo SMS, offered as "Is this you?"
 * chips. They come from reading the SMS on the phone, which needs a development
 * build, so there are none yet.
 */
export async function getAccountNameSuggestions(): Promise<string[]> {
  return [];
}
