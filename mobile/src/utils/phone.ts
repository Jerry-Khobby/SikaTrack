import {
  AsYouType,
  getExampleNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js/mobile';
import examples from 'libphonenumber-js/mobile/examples';

/**
 * Spaces what someone types the way their country writes numbers. Deletions
 * are left as typed, so backspace never fights the formatting.
 */
export function formatPhoneInput(text: string, previous: string, country: CountryCode) {
  if (text.length < previous.length) {
    return text;
  }
  return new AsYouType(country).input(text);
}

/** The number in E.164 (`+233241234567`), or null if it isn't a mobile number in that country. */
export function parsePhoneNumber(text: string, country: CountryCode) {
  const number = parsePhoneNumberFromString(text, country);
  return number?.isValid() && number.country === country ? number.number : null;
}

/** `+233241234567` → `+233 24 123 4567`. */
export function formatPhoneNumber(e164: string) {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}

/** A sample mobile number for that country, written the local way (`023 123 4567`). */
export function examplePhoneNumber(country: CountryCode) {
  return getExampleNumber(country, examples)?.formatNational();
}
