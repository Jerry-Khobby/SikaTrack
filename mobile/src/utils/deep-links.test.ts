import { routeForLink } from './deep-links';

describe('routeForLink', () => {
  it.each([
    ['sikatrack://summary', '/home'],
    ['sikatrack://transactions', '/transactions'],
    ['sikatrack://transactions/txn_9Qe1', '/transactions/txn_9Qe1'],
    ['sikatrack://budgets/food', '/budgets'],
    ['sikatrack://categories/food', '/spending'],
    ['sikatrack://fees', '/spending'],
    ['sikatrack://recurring/rec_1', '/more'],
    ['sikatrack://balances', '/more'],
    ['sikatrack://sync', '/more'],
  ])('opens %s at %s', (link, route) => {
    expect(routeForLink(link)).toBe(route);
  });

  it('ignores links it does not know', () => {
    expect(routeForLink('sikatrack://somewhere-new')).toBeNull();
    expect(routeForLink('https://example.com')).toBeNull();
    expect(routeForLink(null)).toBeNull();
  });
});
