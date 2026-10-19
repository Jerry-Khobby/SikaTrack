import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { WalletSheet, type WalletSheetProps } from './wallet-sheet';

const providers = [
  { code: 'mtn_momo', name: 'MTN MoMo' },
  { code: 'ghanapay', name: 'GhanaPay' },
];

async function renderSheet(props: Partial<WalletSheetProps> = {}) {
  const handlers = { onSave: jest.fn().mockResolvedValue(undefined), onClose: jest.fn() };
  await render(
    <WalletSheet
      mode="add"
      providers={providers}
      initial={{ provider: 'mtn_momo', phoneNumber: '', accountName: '', label: '' }}
      country="GH"
      nameSuggestions={[]}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe('WalletSheet', () => {
  it('starts on the chosen provider with the number prefilled', async () => {
    await renderSheet({
      initial: { provider: 'ghanapay', phoneNumber: '+233241234567', accountName: '', label: '' },
    });

    expect(screen.getByRole('radio', { name: 'GhanaPay' })).toBeChecked();
    expect(screen.getByLabelText('Phone number')).toHaveDisplayValue('024 123 4567');
  });

  it('keeps Save off until the number and name are filled in', async () => {
    await renderSheet();
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Phone number'), '0241234567');
    expect(save).toBeDisabled();

    await fireEvent.changeText(screen.getByLabelText('Name on the account'), 'JERRY K MENSAH');
    expect(save).toBeEnabled();
  });

  it('saves the wallet with the number in E.164 and no empty label', async () => {
    const { onSave } = await renderSheet();

    await fireEvent.press(screen.getByRole('radio', { name: 'GhanaPay' }));
    await fireEvent.changeText(screen.getByLabelText('Phone number'), '0205550142');
    await fireEvent.changeText(screen.getByLabelText('Name on the account'), ' JERRY K MENSAH ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      provider: 'ghanapay',
      phoneNumber: '+233205550142',
      accountName: 'JERRY K MENSAH',
      label: null,
    });
  });

  it('fills the name from a suggestion', async () => {
    await renderSheet({ nameSuggestions: ['JERRY K MENSAH', 'JERRY MENSAH'] });

    await fireEvent.press(screen.getByRole('button', { name: 'JERRY MENSAH' }));

    expect(screen.getByLabelText('Name on the account')).toHaveDisplayValue('JERRY MENSAH');
  });

  it('shows why a save failed', async () => {
    await renderSheet({
      onSave: jest.fn().mockRejectedValue(new Error('This wallet is already on your account.')),
      initial: { provider: 'mtn_momo', phoneNumber: '+233241234567', accountName: 'JERRY', label: '' },
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(screen.getByText('This wallet is already on your account.')).toBeOnTheScreen(),
    );
  });

  it('only lets the name and label change when editing', async () => {
    await renderSheet({
      mode: 'edit',
      initial: {
        provider: 'mtn_momo',
        phoneNumber: '+233241234567',
        accountName: 'JERRY K MENSAH',
        label: 'Main MoMo',
      },
    });

    expect(screen.getByText('Edit wallet')).toBeOnTheScreen();
    expect(screen.getByLabelText('Phone number')).not.toBeEnabled();
    expect(screen.getByRole('radio', { name: 'GhanaPay' })).toBeDisabled();
  });
});
