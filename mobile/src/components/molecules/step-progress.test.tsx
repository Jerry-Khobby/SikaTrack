import { render, screen } from '@testing-library/react-native';

import { StepProgress } from './step-progress';

describe('StepProgress', () => {
  it('names the step for screen readers', async () => {
    await render(<StepProgress step={3} total={5} />);

    expect(screen.getByRole('progressbar', { name: 'Step 3 of 5' })).toBeOnTheScreen();
    expect(screen.queryByText('Step 3 of 5')).toBeNull();
  });

  it('writes the step under the bar when asked', async () => {
    await render(<StepProgress step={1} total={5} showLabel />);

    expect(screen.getByText('Step 1 of 5')).toBeOnTheScreen();
  });
});
