import { fireEvent, render, screen } from '@testing-library/react-native';

import { Toggle } from './toggle';

describe('Toggle', () => {
  it('reports whether it is on', async () => {
    await render(<Toggle value accessibilityLabel="Budget alerts" onValueChange={jest.fn()} />);

    expect(screen.getByRole('switch', { name: 'Budget alerts' })).toBeChecked();
  });

  it('asks for the opposite value when pressed', async () => {
    const onValueChange = jest.fn();
    await render(
      <Toggle value={false} accessibilityLabel="New data ready" onValueChange={onValueChange} />,
    );

    await fireEvent.press(screen.getByRole('switch', { name: 'New data ready' }));

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
