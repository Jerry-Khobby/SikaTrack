import { fireEvent, render, screen } from '@testing-library/react-native';

import { findCountry, listCountries } from '@/utils/countries';

import { CountryPicker } from './country-picker';

async function renderPicker() {
  const handlers = { onSelect: jest.fn(), onClose: jest.fn() };
  await render(
    <CountryPicker
      visible
      countries={listCountries()}
      supportedCodes={['GH']}
      selectedCode="GH"
      {...handlers}
    />,
  );
  return handlers;
}

describe('CountryPicker', () => {
  it('lists supported countries first, under their own heading', async () => {
    await renderPicker();

    expect(screen.getByText('Available now')).toBeOnTheScreen();
    expect(screen.getByText('Not available yet')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ghana, +233' })).toBeSelected();
  });

  it('finds a country by name or dialling code', async () => {
    await renderPicker();
    const search = screen.getByLabelText('Search by country or code');

    await fireEvent.changeText(search, 'niger');
    expect(screen.getByRole('button', { name: 'Nigeria, +234' })).toBeOnTheScreen();
    expect(screen.queryByText('Available now')).toBeNull();

    await fireEvent.changeText(search, '+233');
    expect(screen.getByRole('button', { name: 'Ghana, +233' })).toBeOnTheScreen();
  });

  it('says so when nothing matches', async () => {
    await renderPicker();

    await fireEvent.changeText(screen.getByLabelText('Search by country or code'), 'zzzz');

    expect(screen.getByText(/No country matches/)).toBeOnTheScreen();
  });

  it('hands back the chosen country', async () => {
    const { onSelect } = await renderPicker();

    await fireEvent.changeText(screen.getByLabelText('Search by country or code'), 'nigeria');
    await fireEvent.press(screen.getByRole('button', { name: 'Nigeria, +234' }));

    expect(onSelect).toHaveBeenCalledWith(findCountry('NG'));
  });

  it('closes from the close button', async () => {
    const { onClose } = await renderPicker();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
