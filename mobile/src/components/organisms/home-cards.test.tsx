import { fireEvent, render, screen } from '@testing-library/react-native';

import type { Budget } from '@/services/budgets';
import type { MonthSummary } from '@/services/summary';

import { BudgetsCard } from './budgets-card';
import { CategoryBreakdownCard } from './category-breakdown-card';
import { SpendingHero } from './spending-hero';

const summary: MonthSummary = {
  period: { from: '2026-10-01', to: '2026-10-20', days: 20 },
  currency: 'GHS',
  moneyOut: '2723.40',
  moneyIn: '1480.00',
  net: '-1243.40',
  fees: '21.30',
  avgDailySpend: '136.17',
  spendingTransactions: 128,
  compare: { month: '2026-09', moneyOut: '3920.00', moneyOutChange: '-0.305', moneyInChange: null },
  topCategory: null,
  recurringMonthlyCost: '235.00',
  includesProvisional: false,
};

describe('SpendingHero', () => {
  it('shows money out, the change, and the three small stats', async () => {
    await render(<SpendingHero summary={summary} month="2026-10" />);

    expect(screen.getByText('GHS 2,723.40')).toBeOnTheScreen();
    expect(screen.getByLabelText('Down 30.5% vs September')).toBeOnTheScreen();
    expect(screen.getByLabelText('Money in: +GHS 1,480')).toBeOnTheScreen();
    expect(screen.getByLabelText('Net: -GHS 1,243')).toBeOnTheScreen();
    expect(screen.getByLabelText('Fees & tax: GHS 21.30')).toBeOnTheScreen();
    expect(screen.getByText(/GHS 136.17 a day on average · 128 payments/)).toBeOnTheScreen();
  });

  it('says so when there is no spending in the month', async () => {
    await render(<SpendingHero summary={{ ...summary, spendingTransactions: 0 }} month="2026-10" />);

    expect(screen.getByText('No spending in October yet')).toBeOnTheScreen();
    expect(screen.queryByText('GHS 2,723.40')).toBeNull();
  });
});

describe('CategoryBreakdownCard', () => {
  const item = (id: string, name: string, amount: string, share: string) => ({
    category: { id, name, group: 'spending' as const },
    amount,
    share,
    transactions: 1,
    budget: null,
  });

  it('charts the top five plus Other and lists the top three', async () => {
    const onPressCategory = jest.fn();
    await render(
      <CategoryBreakdownCard
        currency="GHS"
        spending={{
          total: '100.00',
          items: [
            item('cash_withdrawal', 'Cash Withdrawal', '40.00', '0.400'),
            item('food', 'Food', '20.00', '0.200'),
            item('transport', 'Transport', '15.00', '0.150'),
            item('bills', 'Bills', '10.00', '0.100'),
            item('shopping', 'Shopping', '5.00', '0.050'),
            item('health', 'Health', '6.00', '0.060'),
            item('giving', 'Giving', '4.00', '0.040'),
          ],
        }}
        onPressCategory={onPressCategory}
        onSeeAll={jest.fn()}
      />,
    );

    expect(screen.getByRole('image', { name: /Shopping 5%, Other 10%/ })).toBeOnTheScreen();
    expect(screen.getByText('GHS 100')).toBeOnTheScreen();
    expect(screen.getByText('Transport')).toBeOnTheScreen();
    expect(screen.queryByText('Bills')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Food: GHS 20.00 · 20%' }));
    expect(onPressCategory).toHaveBeenCalledWith('food');
  });
});

describe('BudgetsCard', () => {
  const budget = (id: string, name: string, spent: string, limit: string, used: string, state: Budget['state']): Budget => ({
    id,
    category: { id, name, group: 'spending' },
    spent,
    limit,
    remaining: '0.00',
    used,
    projected: spent,
    state,
    alertThresholds: ['0.8', '1.0'],
  });

  it('shows each budget against its limit', async () => {
    await render(
      <BudgetsCard
        budgets={[budget('cash_withdrawal', 'Cash Withdrawal', '1122.00', '1000.00', '1.122', 'over'), budget('food', 'Food', '612.50', '700.00', '0.875', 'warning')]}
        daysLeft={13}
        currency="GHS"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('GHS 1,122 of 1,000')).toBeOnTheScreen();
    expect(screen.getByText('GHS 612.50 of 700')).toBeOnTheScreen();
    expect(screen.getByText('13 days left')).toBeOnTheScreen();
  });

  it('offers to set one when there are none', async () => {
    const onPress = jest.fn();
    await render(<BudgetsCard budgets={[]} daysLeft={13} currency="GHS" onPress={onPress} />);

    await fireEvent.press(screen.getByRole('button', { name: /Set a budget/ }));
    expect(onPress).toHaveBeenCalled();
  });
});
