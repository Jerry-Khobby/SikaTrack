/**
 * Money arrives as decimal strings (`"2723.40"`). Arithmetic happens in whole
 * pesewas so it never goes through floats (docs/ui-spec.md §3).
 */

/** `"2723.4"` → `272340`. */
export function toPesewas(amount: string) {
  const negative = amount.trim().startsWith('-');
  const [whole, fraction = ''] = amount.trim().replace(/^[-+]/, '').split('.');
  const value = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  return negative ? -value : value;
}

/** `272340` → `"2723.40"`. */
export function fromPesewas(pesewas: number) {
  const negative = pesewas < 0;
  const value = Math.abs(Math.round(pesewas));
  return `${negative ? '-' : ''}${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`;
}

/** Adds decimal strings without floats. */
export function sumMoney(amounts: string[]) {
  return fromPesewas(amounts.reduce((total, amount) => total + toPesewas(amount), 0));
}

/** True when the string is a valid amount such as `12`, `12.5` or `12.50`. */
export function isMoney(text: string) {
  return /^\d+(\.\d{1,2})?$/.test(text.trim());
}
