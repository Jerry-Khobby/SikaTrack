import { fireEvent, render, screen } from '@testing-library/react-native';

import { findCountry } from '@/utils/countries';

import { PhoneField } from './phone-field';

const ghana = findCountry('GH')!;

async function renderField(props: Partial<React.ComponentProps<typeof PhoneField>> = {}) {
  const handlers = { onPressCountry: jest.fn(), onChangeText: jest.fn() };
  await render(<PhoneField label="Phone number" country={ghana} value="" {...handlers} {...props} />);
  return handlers;
}

describe('PhoneField', () => {
  it("shows the chosen country's dialling code", async () => {
    await renderField();
    expect(screen.getByText('+233')).toBeOnTheScreen();
  });

  it('opens the country picker from the country button', async () => {
    const { onPressCountry } = await renderField();

    await fireEvent.press(screen.getByRole('button', { name: /Country: Ghana, \+233/ }));

    expect(onPressCountry).toHaveBeenCalledTimes(1);
  });

  it('passes typing up', async () => {
    const { onChangeText } = await renderField();

    await fireEvent.changeText(screen.getByLabelText('Phone number'), '024');

    expect(onChangeText).toHaveBeenCalledWith('024');
  });

  it('shows the error in place of the hint', async () => {
    await renderField({ hint: 'A hint', error: 'Enter a mobile number from Ghana.' });

    expect(screen.getByText('Enter a mobile number from Ghana.')).toBeOnTheScreen();
    expect(screen.queryByText('A hint')).toBeNull();
  });
});
