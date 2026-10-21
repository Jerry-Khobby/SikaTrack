/**
 * Turns the backend's `sikatrack://` links (docs/ui-spec.md §2, Deep links)
 * into app routes.
 */

export type AppRoute =
  | '/home'
  | '/transactions'
  | `/transactions/${string}`
  | '/spending'
  | '/spending?view=fees'
  | `/categories/${string}`
  | '/budgets'
  | `/budgets?highlight=${string}`
  | '/more'
  | '/wallets'
  | '/recurring'
  | `/recurring/${string}`
  | '/notifications'
  | '/sync';

const ROUTES: { pattern: RegExp; route: (match: RegExpMatchArray) => AppRoute }[] = [
  { pattern: /^summary$/, route: () => '/home' },
  { pattern: /^transactions$/, route: () => '/transactions' },
  { pattern: /^transactions\/(.+)$/, route: (m) => `/transactions/${m[1]}` },
  { pattern: /^categories\/(.+)$/, route: (m) => `/categories/${m[1]}` },
  { pattern: /^fees$/, route: () => '/spending?view=fees' },
  { pattern: /^budgets$/, route: () => '/budgets' },
  // One budget opens the Budgets tab with that budget picked out.
  { pattern: /^budgets\/(.+)$/, route: (m) => `/budgets?highlight=${m[1]}` },
  { pattern: /^recurring$/, route: () => '/recurring' },
  { pattern: /^recurring\/(.+)$/, route: (m) => `/recurring/${m[1]}` },
  { pattern: /^balances$/, route: () => '/wallets' },
  { pattern: /^wallets$/, route: () => '/wallets' },
  { pattern: /^sync$/, route: () => '/sync' },
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
