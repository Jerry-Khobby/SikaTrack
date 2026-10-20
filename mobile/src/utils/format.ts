/** Display rules from docs/ui-spec.md §3 (Money, numbers, dates). */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function groupThousands(digits: string) {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `1962` → `1,962`. */
export function formatCount(value: number) {
  return groupThousands(String(Math.round(value)));
}

/**
 * A decimal string from the API, never turned into a float: `"2723.4"`, `GHS` →
 * `GHS 2,723.40`.
 */
export function formatMoney(amount: string, currency: string) {
  const negative = amount.startsWith('-');
  const [whole, fraction = ''] = amount.replace(/^[-+]/, '').split('.');
  const cents = fraction.padEnd(2, '0').slice(0, 2);
  return `${negative ? '-' : ''}${currency} ${groupThousands(whole)}.${cents}`;
}

/**
 * Big totals drop the pesewas, rounding half up: `"2723.40"` → `GHS 2,723`,
 * `"-1243.50"` → `-GHS 1,244`.
 */
export function formatMoneyWhole(amount: string, currency: string) {
  const negative = amount.startsWith('-');
  const [whole, fraction = '0'] = amount.replace(/^[-+]/, '').split('.');
  const rounded = Number(fraction.padEnd(2, '0').slice(0, 2)) >= 50 ? String(Number(whole) + 1) : whole;
  return `${negative && rounded !== '0' ? '-' : ''}${currency} ${groupThousands(rounded)}`;
}

/** Drops `.00` but keeps real pesewas: `GHS 1,122`, `GHS 612.50`. */
export function formatMoneyShort(amount: string, currency: string) {
  return formatMoney(amount, currency).replace(/\.00$/, '');
}

/**
 * Money in gets a `+`, money out none: `+GHS 150.00`, `GHS 40.00`. Pass
 * `signed` for amounts shown on their own, where out reads `-GHS 40.00`.
 */
export function formatDirectedMoney(
  amount: string,
  direction: 'in' | 'out',
  currency: string,
  options: { signed?: boolean; whole?: boolean } = {},
) {
  const text = options.whole ? formatMoneyWhole(amount, currency) : formatMoney(amount, currency);
  if (direction === 'in') return `+${text}`;
  return options.signed ? `-${text}` : text;
}

/** A net amount with its sign either way: `+GHS 120.00`, `-GHS 1,243`. */
export function formatSignedMoney(amount: string, currency: string, options: { whole?: boolean } = {}) {
  const text = options.whole ? formatMoneyWhole(amount, currency) : formatMoney(amount, currency);
  return text.startsWith('-') || /^[A-Z]+ 0(\.00)?$/.test(text) ? text : `+${text}`;
}

/** A fraction string as a whole percentage: `"0.412"` → `41%`. */
export function formatShare(fraction: string) {
  return `${Math.round(Number(fraction) * 100)}%`;
}

/** A change as a fraction string: `"-0.305"` → `{ text: '30.5%', down: true }`. */
export function formatChange(fraction: string) {
  const percent = Math.abs(Number(fraction) * 100);
  return {
    text: `${percent >= 10 ? percent.toFixed(1).replace(/\.0$/, '') : percent.toFixed(1)}%`,
    down: Number(fraction) < 0,
  };
}

/** `2025-11-01` (or `2025-11`) → `Nov 2025`. */
export function formatShortMonth(isoDate: string) {
  const [year, month] = isoDate.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
