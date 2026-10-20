/**
 * Turns the backend's `sikatrack://` links (docs/ui-spec.md §2, Deep links)
 * into app routes. Screens not built yet open their tab; point their row here
 * at the real screen when it exists (only S34 sync status is left).
 */

export type AppRoute =
  | '/home'
  | '/transactions'
  | `/transactions/${string}`
  | '/spending'
  | '/spending?view=fees'
  | `/categories/${string}`
  | '/budgets'
  | '/more'
  | '/wallets'
  | '/recurring'
  | `/recurring/${string}`
  | '/notifications';

const ROUTES: { pattern: RegExp; route: (match: RegExpMatchArray) => AppRoute }[] = [
  { pattern: /^summary$/, route: () => '/home' },
  { pattern: /^transactions$/, route: () => '/transactions' },
  { pattern: /^transactions\/(.+)$/, route: (m) => `/transactions/${m[1]}` },
  { pattern: /^categories\/(.+)$/, route: (m) => `/categories/${m[1]}` },
  { pattern: /^fees$/, route: () => '/spending?view=fees' },
  // S23 with one budget highlighted: the Budgets tab until it's built.
  { pattern: /^budgets(\/.+)?$/, route: () => '/budgets' },
  { pattern: /^recurring$/, route: () => '/recurring' },
  { pattern: /^recurring\/(.+)$/, route: (m) => `/recurring/${m[1]}` },
  { pattern: /^balances$/, route: () => '/wallets' },
  // S34 sync status: the More tab until it's built.
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
