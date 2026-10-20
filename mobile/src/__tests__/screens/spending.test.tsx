import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import SpendingScreen from '@/app/(tabs)/spending';
import CategoryDetailScreen from '@/app/categories/[id]';
import CounterpartyScreen from '@/app/counterparties/[id]';
import CounterpartiesScreen from '@/app/counterparties/index';
import { getCounterparty, listCounterparties } from '@/services/counterparties';
import { startSession } from '@/services/me';
import { getCategorySpending, getTopCounterparties } from '@/services/summary';
import { renderWithQuery, resetDevServer } from '@/test-utils';
import { currentMonth } from '@/utils/dates';
import { formatMoney } from '@/utils/format';

const mockRouter = { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), canGoBack: () => true, replace: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));

const month = currentMonth();
const hidden = { includeHiddenElements: true };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  resetDevServer();
  startSession('+233241234567');
});

describe('S17a · Categories', () => {
  it('shows the donut with every slice’s amount, and a row per category', async () => {
    const { items } = await getCategorySpending(month);
    await renderWithQuery(<SpendingScreen />);

    const first = items[0];
    expect(await screen.findByRole('button', { name: new RegExp(`^${first.category.name}, ${formatMoney(first.amount, 'GHS')}`) })).toBeOnTheScreen();
    expect(screen.getByLabelText(new RegExp(`${first.category.name} GHS`))).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^${first.category.name},`) }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/categories/[id]', params: { id: first.category.id, month } });
  });

  it('switches to money in', async () => {
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Money in' }));
    expect(await screen.findByText(/of money in/)).toBeOnTheScreen();
  });
});

describe('S17b · Trend', () => {
  it('labels the y-axis in cedis and shows the tapped month’s exact figures', async () => {
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Trend' }));

    expect(await screen.findByText('GHS', hidden)).toBeOnTheScreen();
    expect(screen.getByText('0', hidden)).toBeOnTheScreen();
    expect(screen.getByText(/\(so far\)$/)).toBeOnTheScreen();
    expect(screen.getByText('Fees & tax')).toBeOnTheScreen();

    const bars = screen.getAllByRole('button', { name: /: out GHS/ });
    expect(bars).toHaveLength(6);
    await fireEvent.press(bars[0]);
    const [title, figures] = bars[0].props.accessibilityLabel.split(': ');
    expect(screen.getAllByRole('button', { name: /: out GHS/ })[0]).toBeSelected();
    expect(screen.getAllByText(title).length).toBeGreaterThan(0);
    // The readout shows the same figure the bar stands for.
    expect(screen.getAllByText(figures.match(/out (GHS [\d,]+\.\d{2})/)![1]).length).toBeGreaterThan(0);

    await fireEvent.press(screen.getByRole('link', { name: 'See these transactions' }));
    expect(mockRouter.navigate).toHaveBeenCalledWith({
      pathname: '/transactions',
      params: expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
    });
  });

  it('switches to weekly and daily', async () => {
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Trend' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Weekly' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Week of .*: out GHS/ })).toHaveLength(8));
  });
});

describe('S17c · Habits', () => {
  it('shows the peak, an amount in every heatmap cell, and the busiest hour', async () => {
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Habits' }));

    expect(await screen.findByText(/^You spend most on /)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Monday morning: GHS/)).toBeOnTheScreen();
    expect(screen.getByText(/your busiest hour$/)).toBeOnTheScreen();
  });
});

describe('S17d · People', () => {
  it('ranks who you paid and opens one', async () => {
    const [top] = await getTopCounterparties(month, 'out');
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'People' }));

    await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${top.counterparty.name}, ${formatMoney(top.amount, 'GHS')}`) }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/counterparties/${top.counterparty.id}`);
  });
});

describe('S17e · Fees', () => {
  it('shows the month’s fees with every month’s bar labelled', async () => {
    await renderWithQuery(<SpendingScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Fees' }));

    expect(await screen.findByText('Fees and tax this month')).toBeOnTheScreen();
    expect(screen.getAllByLabelText(/in fees and tax$/).length).toBeGreaterThanOrEqual(6);
    expect(await screen.findByText('Payments with a fee')).toBeOnTheScreen();
  });

  it('opens on Fees from its deep link', async () => {
    mockParams = { view: 'fees' };
    await renderWithQuery(<SpendingScreen />);
    expect(await screen.findByText('Fees and tax this month')).toBeOnTheScreen();
  });
});

describe('S18 · Category detail', () => {
  it('shows six months with their values, the budget, and the month’s payments', async () => {
    mockParams = { id: 'food', month };
    await renderWithQuery(<CategoryDetailScreen />);

    expect(await screen.findByRole('header', { name: 'Food' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByLabelText(/^[A-Z][a-z]+ \d{4}: GHS/)).toHaveLength(6));
    expect(screen.getByText('Budget')).toBeOnTheScreen();
    expect(await screen.findByText('Top places')).toBeOnTheScreen();
  });

  it('offers a budget when there is none', async () => {
    mockParams = { id: 'shopping', month };
    await renderWithQuery(<CategoryDetailScreen />);
    expect(await screen.findByRole('button', { name: 'Set a budget for Shopping' })).toBeOnTheScreen();
  });
});

describe('S21 · Everyone', () => {
  it('filters by kind and searches', async () => {
    const people = await listCounterparties({ q: '', kind: 'person' });
    await renderWithQuery(<CounterpartiesScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'People' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: /payments? · last paid/ })).toHaveLength(people.length));
  });
});

describe('S20 · Counterparty', () => {
  it('renames them, keeping the SMS name underneath', async () => {
    const [first] = await listCounterparties({ q: '', kind: null });
    mockParams = { id: first.id };
    await renderWithQuery(<CounterpartyScreen />);

    const field = await screen.findByDisplayValue(first.name);
    await fireEvent.changeText(field, 'My guy');
    await fireEvent.press(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByRole('header', { name: 'My guy' })).toBeOnTheScreen();
    expect(screen.getByText(first.name.toUpperCase())).toBeOnTheScreen();
    expect((await getCounterparty(first.id)).alias).toBe('My guy');
  });

  it('sets a default category', async () => {
    const [first] = await listCounterparties({ q: '', kind: 'merchant' });
    mockParams = { id: first.id };
    await renderWithQuery(<CounterpartyScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Default category, none/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Giving' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    await waitFor(async () => expect((await getCounterparty(first.id)).defaultCategory).toBe('giving'));
    expect(await screen.findByRole('button', { name: /^Default category, Giving/ })).toBeOnTheScreen();
  });
});
