import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './button';

describe('Button', () => {
  it('calls onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button label="Get started" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Get started' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing and reports disabled when disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Send code" onPress={onPress} disabled />);

    const button = screen.getByRole('button');
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('swaps the label for a spinner and reports busy while loading', async () => {
    await render(<Button label="Send code" onPress={jest.fn()} loading />);

    expect(screen.queryByText('Send code')).toBeNull();
    expect(screen.getByRole('button')).toBeBusy();
  });
});
