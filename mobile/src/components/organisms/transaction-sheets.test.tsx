import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Category } from '@/services/categories';
import { DEFAULT_FILTERS } from '@/services/transactions';

import { CategoryPickerSheet } from './category-picker-sheet';
import { FilterBar } from './filter-bar';
import { FiltersSheet } from './filters-sheet';

const categories: Category[] = [
  { id: 'food', name: 'Food', group: 'spending', userSelectable: true },
  { id: 'transport', name: 'Transport', group: 'spending', userSelectable: true },
  { id: 'income', name: 'Income', group: 'money_in', userSelectable: true },
  { id: 'savings', name: 'Savings', group: 'own_money', userSelectable: true },
  { id: 'own_transfers', name: 'Own Transfers', group: 'own_money', userSelectable: false },
];

describe('FilterBar', () => {
  it('names active filters and clears them one at a time', async () => {
    const onChange = jest.fn();
    const filters = { ...DEFAULT_FILTERS, direction: 'out' as const, categories: ['food'] };
    await render(
      <FilterBar filters={filters} categoryNames={{ food: 'Food' }} walletNames={{}} onOpenFilters={jest.fn()} onChange={onChange} />,
    );

    expect(screen.getByRole('button', { name: 'Last 30 days' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Money out' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Food' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Clear Money out' }));
    expect(onChange).toHaveBeenCalledWith({ ...filters, direction: null });
  });
});

describe('FiltersSheet', () => {
  async function renderSheet() {
    const onApply = jest.fn();
    await render(
      <FiltersSheet
        initial={DEFAULT_FILTERS}
        categories={categories}
        wallets={[{ id: 'wal_1', provider: 'mtn_momo', label: 'Main MoMo', phoneNumber: '+233241234567' }]}
        providerNames={{ mtn_momo: 'MTN MoMo' }}
        currency="GHS"
        onApply={onApply}
        onClose={jest.fn()}
      />,
    );
    return onApply;
  }

  it('applies the chosen date, direction, categories, wallet and amounts', async () => {
    const onApply = await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'This month' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Money in' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Food' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Main MoMo' }));
    await fireEvent.changeText(screen.getByLabelText('Minimum amount'), '20');
    await fireEvent.press(screen.getByRole('button', { name: 'Show results' }));

    expect(onApply).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      date: { preset: 'this_month' },
      direction: 'in',
      categories: ['food'],
      walletId: 'wal_1',
      minAmount: '20',
      maxAmount: null,
    });
  });

  it('only offers categories people can pick', async () => {
    await renderSheet();
    expect(screen.queryByRole('button', { name: 'Own Transfers' })).toBeNull();
  });

  it('will not apply an impossible range', async () => {
    await renderSheet();

    await fireEvent.press(screen.getByRole('button', { name: 'Custom' }));
    await fireEvent.changeText(screen.getByLabelText('From'), '2026-10-10');
    await fireEvent.changeText(screen.getByLabelText('To'), '2026-10-01');

    expect(screen.getByText('The start date must come before the end date.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Show results' })).toBeDisabled();
  });

  it('will not apply a minimum above the maximum', async () => {
    await renderSheet();

    await fireEvent.changeText(screen.getByLabelText('Minimum amount'), '200');
    await fireEvent.changeText(screen.getByLabelText('Maximum amount'), '50');

    expect(screen.getByRole('button', { name: 'Show results' })).toBeDisabled();
  });
});

describe('CategoryPickerSheet', () => {
  async function renderPicker(userOverride = false) {
    const onSave = jest.fn();
    await render(
      <CategoryPickerSheet
        categories={categories}
        currentId="food"
        counterpartyName="Papaye Osu"
        userOverride={userOverride}
        saving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />,
    );
    return onSave;
  }

  it('groups the categories and ticks the current one', async () => {
    await renderPicker();

    expect(screen.getByText('Spending')).toBeOnTheScreen();
    expect(screen.getByText('Money in')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Food' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('saves a new category, for the counterparty too when asked', async () => {
    const onSave = await renderPicker();

    await fireEvent.press(screen.getByRole('button', { name: 'Transport' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Always use this for Papaye Osu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ category: 'transport', applyToCounterparty: true });
  });

  it('can go back to the automatic category after an override', async () => {
    const onSave = await renderPicker(true);

    await fireEvent.press(screen.getByRole('link', { name: 'Go back to automatic' }));

    expect(onSave).toHaveBeenCalledWith({ category: null, applyToCounterparty: false });
  });
});
