import {
  UnsupportedProviderError,
  WalletConflictError,
  addWallet,
  listWallets,
  resetWallets,
  updateWallet,
} from './wallets';

const momo = {
  provider: 'mtn_momo',
  phoneNumber: '+233241234567',
  accountName: 'JERRY K MENSAH',
  label: null,
};

beforeEach(() => resetWallets());

describe('wallets stand-in', () => {
  it('adds a wallet and lists it', async () => {
    const wallet = await addWallet(momo);

    expect(wallet.id).toEqual(expect.any(String));
    expect(await listWallets()).toEqual([wallet]);
  });

  it('refuses the same wallet twice', async () => {
    await addWallet(momo);
    await expect(addWallet(momo)).rejects.toBeInstanceOf(WalletConflictError);
  });

  it('refuses a provider the server does not support yet', async () => {
    await expect(addWallet({ ...momo, provider: 'telecel_cash' })).rejects.toBeInstanceOf(
      UnsupportedProviderError,
    );
  });

  it('changes only the account name and the label', async () => {
    const wallet = await addWallet(momo);

    const updated = await updateWallet(wallet.id, { accountName: 'JERRY MENSAH', label: 'Main' });

    expect(updated).toEqual({ ...wallet, accountName: 'JERRY MENSAH', label: 'Main' });
  });
});
