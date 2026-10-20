/**
 * Turns the backend's `sikatrack://` links (docs/ui-spec.md §2, Deep links)
 * into app routes. Screens not built yet open their tab; point their row here
 * at the real screen when it exists.
 */

export type AppRoute =
  | '/home'
  | '/transactions'
  | `/transactions/${string}`
  | '/spending'
  | '/budgets'
  | '/more'
  | '/notifications';

const ROUTES: { pattern: RegExp; route: (match: RegExpMatchArray) => AppRoute }[] = [
  { pattern: /^summary$/, route: () => '/home' },
  { pattern: /^transactions$/, route: () => '/transactions' },
  { pattern: /^transactions\/(.+)$/, route: (m) => `/transactions/${m[1]}` },
  // S18 category detail and S17e fees: the Spending tab until they're built.
  { pattern: /^categories\/.+$/, route: () => '/spending' },
  { pattern: /^fees$/, route: () => '/spending' },
  // S23 with one budget highlighted: the Budgets tab until it's built.
  { pattern: /^budgets(\/.+)?$/, route: () => '/budgets' },
  // S26 wallets, S28/S29 recurring and S34 sync live under More.
  { pattern: /^recurring(\/.+)?$/, route: () => '/more' },
  { pattern: /^balances$/, route: () => '/more' },
  { pattern: /^sync$/, route: () => '/more' },
];

/** The route a deep link opens, or null for a link the app doesn't know. */
export function routeForLink(link: string | null | undefined): AppRoute | null {
  const path = link?.match(/^sikatrack:\/\/(.+)$/)?.[1];
  if (!path) return null;
  for (const { pattern, route } of ROUTES) {
    const match = path.match(pattern);
    if (match) return route(match);
  }
  return null;
}
