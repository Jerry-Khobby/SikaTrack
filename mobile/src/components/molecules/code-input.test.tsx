import { fireEvent, render, screen } from '@testing-library/react-native';

import { CodeInput } from './code-input';

describe('CodeInput', () => {
  it('shows each digit in its own box', async () => {
    await render(<CodeInput value="482" length={6} onChangeText={jest.fn()} />);

    expect(screen.getByText('4')).toBeOnTheScreen();
    expect(screen.getByText('8')).toBeOnTheScreen();
    expect(screen.getByText('2')).toBeOnTheScreen();
  });

  it('keeps only digits and stops at the code length, e.g. for a pasted code', async () => {
    const onChangeText = jest.fn();
    await render(<CodeInput value="" length={6} onChangeText={onChangeText} />);

    await fireEvent.changeText(screen.getByLabelText('6-digit code'), 'Code: 48-29 31 77');

    expect(onChangeText).toHaveBeenCalledWith('482931');
  });

  it('cannot be typed in when not editable', async () => {
    await render(<CodeInput value="" length={6} onChangeText={jest.fn()} editable={false} />);

    expect(screen.getByLabelText('6-digit code')).not.toBeEnabled();
  });
});
