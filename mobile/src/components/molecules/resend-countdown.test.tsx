import { fireEvent, render, screen } from '@testing-library/react-native';

import { ResendCountdown } from './resend-countdown';

describe('ResendCountdown', () => {
  it('shows the time left as m:ss', async () => {
    await render(<ResendCountdown secondsLeft={42} onResend={jest.fn()} />);

    expect(screen.getByText('0:42')).toBeOnTheScreen();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('becomes a Resend code link at zero', async () => {
    const onResend = jest.fn();
    await render(<ResendCountdown secondsLeft={0} onResend={onResend} />);

    await fireEvent.press(screen.getByRole('link', { name: 'Resend code' }));

    expect(onResend).toHaveBeenCalledTimes(1);
  });
});
