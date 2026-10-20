import { fireEvent, render, screen } from '@testing-library/react-native';

import { BarChart } from './bar-chart';
import { Heatmap } from './heatmap';
import { LineChart } from './line-chart';

describe('BarChart', () => {
  const props = {
    labels: ['Aug', 'Sep', 'Oct'],
    series: [{ key: 'out', color: '#2a78d6', values: [1900, 3918.6, 2723.4] }],
    unit: 'GHS',
    groupLabel: (i: number) => ['August', 'September', 'October'][i],
    accessibilityLabel: 'Money out',
  };

  it('labels the y-axis with round values and the unit, and every bar along the bottom', async () => {
    await render(<BarChart {...props} />);

    expect(screen.getByText('GHS', { includeHiddenElements: true })).toBeOnTheScreen();
    for (const tick of ['0', '2K', '4K']) expect(screen.getByText(tick, { includeHiddenElements: true })).toBeOnTheScreen();
    for (const label of props.labels) expect(screen.getByText(label, { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it('writes each value over its bar when asked', async () => {
    await render(<BarChart {...props} capLabels={['1,900', '3,918.60', '2,723.40']} />);
    expect(screen.getByText('3,918.60')).toBeOnTheScreen();
  });

  it('reports the tapped group', async () => {
    const onSelect = jest.fn();
    await render(<BarChart {...props} onSelect={onSelect} selected={2} />);

    await fireEvent.press(screen.getByRole('button', { name: 'September' }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'October' })).toBeSelected();
  });
});

describe('LineChart', () => {
  it('has a y-axis of round values and labels under the plot', async () => {
    await render(
      <LineChart
        series={[{ values: [12, null, 30, 27.35], color: '#2a78d6' }]}
        reference={{ value: 5, color: '#d03b3b' }}
        unit="GHS"
        xLabels={['21 Sep', '6 Oct', 'Today']}
        surfaceColor="#fff"
        crosshairColor="#000"
        accessibilityLabel="Balance history"
      />,
    );

    expect(screen.getByText('GHS', { includeHiddenElements: true })).toBeOnTheScreen();
    for (const tick of ['0', '20', '40']) expect(screen.getByText(tick, { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByText('Today', { includeHiddenElements: true })).toBeOnTheScreen();
  });
});

describe('Heatmap', () => {
  it('writes each cell’s amount in it and names it for screen readers', async () => {
    await render(
      <Heatmap
        rows={['Mon', 'Tue']}
        columns={['Morning', 'Afternoon']}
        values={[
          [12, 393],
          [0, 40],
        ]}
        color="#2a78d6"
        formatValue={(v) => String(v)}
        cellLabel={(r, c) => `${['Monday', 'Tuesday'][r]} ${['morning', 'afternoon'][c]}`}
      />,
    );

    expect(screen.getByText('393')).toBeOnTheScreen();
    expect(screen.getByText('Morning', { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByLabelText('Monday afternoon')).toBeOnTheScreen();
  });
});
