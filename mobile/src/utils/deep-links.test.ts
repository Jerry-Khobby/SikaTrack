import { routeForLink } from './deep-links';

describe('routeForLink', () => {
  it.each([
    ['sikatrack://summary', '/home'],
    ['sikatrack://transactions', '/transactions'],
    ['sikatrack://transactions/txn_9Qe1', '/transactions/txn_9Qe1'],
    ['sikatrack://budgets', '/budgets'],
    ['sikatrack://budgets/food', '/budgets?highlight=food'],
    ['sikatrack://categories/food', '/categories/food'],
    ['sikatrack://fees', '/spending?view=fees'],
    ['sikatrack://recurring', '/recurring'],
    ['sikatrack://recurring/rec_1', '/recurring/rec_1'],
    ['sikatrack://balances', '/wallets'],
    ['sikatrack://wallets', '/wallets'],
    ['sikatrack://sync', '/sync'],
  ])('opens %s at %s', (link, route) => {
    expect(routeForLink(link)).toBe(route);
  });

  it('ignores links it does not know', () => {
    expect(routeForLink('sikatrack://somewhere-new')).toBeNull();
    expect(routeForLink('https://example.com')).toBeNull();
    expect(routeForLink(null)).toBeNull();
  });
});
