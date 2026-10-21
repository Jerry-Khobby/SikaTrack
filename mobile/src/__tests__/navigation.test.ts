/// <reference types="node" />
/**
 * Every screen is reachable and every link lands on a screen. Reads the source:
 * the route files under src/app, and every path the code navigates to.
 */
import fs from 'fs';
import path from 'path';

import { routeForLink } from '@/utils/deep-links';

const SRC = path.join(__dirname, '..');
const APP = path.join(SRC, 'app');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}

/** `src/app/(tabs)/home.tsx` → `/home`, `recurring/[id].tsx` → `/recurring/[id]`. */
function routeOf(file: string) {
  const route = path
    .relative(APP, file)
    .replace(/\\/g, '/')
    .replace(/\.tsx$/, '')
    .replace(/\([^)]+\)\//g, '')
    .replace(/(^|\/)index$/, '');
  return `/${route}`;
}

const screens = files(APP)
  .filter((f) => f.endsWith('.tsx') && !/(_layout|\+native-intent|\+not-found)\.tsx$/.test(f))
  .map(routeOf);

/** Whether a path someone navigates to (`/recurring/abc`, `/budgets?highlight=food`) is a screen. */
function isScreen(target: string) {
  const clean = target.split('?')[0].replace(/\/$/, '') || '/';
  return screens.some((screen) => {
    const pattern = new RegExp(`^${screen.replace(/\[[^\]]+\]/g, '[^/]+')}$`);
    return pattern.test(clean) || screen === clean;
  });
}

const source = files(SRC)
  .filter((f) => /\.tsx?$/.test(f) && !f.includes('.test.') && !f.includes('__tests__'))
  .map((f) => fs.readFileSync(f, 'utf8'))
  .join('\n');

/** Every literal path the code navigates to or returns as a destination, with `${…}` filled in. */
const targets = [
  ...source.matchAll(/router\.(?:push|navigate|replace)\(\s*[`'"]([^`'"]+)[`'"]/g),
  ...source.matchAll(/pathname:\s*[`'"]([^`'"]+)[`'"]/g),
  ...source.matchAll(/useGoBack\(\s*[`'"]([^`'"]+)[`'"]/g),
  // Services that decide where to go next return the path (e.g. the next onboarding step).
  ...source.matchAll(/return\s+'(\/[a-z][^']*)'/g),
].map((match) => match[1].replace(/\$\{[^}]+\}/g, 'x'));

describe('navigation', () => {
  it('only ever goes to screens that exist', () => {
    expect(targets.length).toBeGreaterThan(40);
    expect(targets.filter((target) => !isScreen(target))).toEqual([]);
  });

  it('can reach every screen', () => {
    // The launch screen opens itself; the rest need something that leads to them.
    const reached = new Set(['/', ...targets.map((t) => t.split('?')[0])]);
    const unreachable = screens.filter(
      (screen) => screen !== '/' && ![...reached].some((target) => isScreen(target) && new RegExp(`^${screen.replace(/\[[^\]]+\]/g, '[^/]+')}$`).test(target)),
    );
    // Tabs are reached through the tab bar.
    expect(unreachable.filter((s) => !['/home', '/transactions', '/spending', '/budgets', '/more'].includes(s))).toEqual([]);
  });

  it('opens a screen for every link the backend sends', () => {
    const links = [
      'summary',
      'transactions',
      'transactions/txn_1',
      'budgets',
      'budgets/food',
      'categories/food',
      'fees',
      'recurring',
      'recurring/rec_1',
      'balances',
      'wallets',
      'sync',
    ];
    for (const link of links) {
      const route = routeForLink(`sikatrack://${link}`);
      expect(route && isScreen(route)).toBe(true);
    }
  });
});
