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

/** `2025-11-01` (or `2025-11`) → `Nov 2025`. */
export function formatShortMonth(isoDate: string) {
  const [year, month] = isoDate.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
}
