import { countries, getEmojiFlag, type TCountryCode } from 'countries-list';
import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js/mobile';

export type Country = {
  code: CountryCode;
  name: string;
  dialCode: string;
  flag: string;
};

let all: Country[] | undefined;

/** Every country with a phone numbering plan, sorted by name. */
export function listCountries() {
  all ??= getCountries()
    .filter((code): code is CountryCode & TCountryCode => code in countries)
    .map((code) => ({
      code,
      name: countries[code].name,
      dialCode: `+${getCountryCallingCode(code)}`,
      flag: getEmojiFlag(code),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return all;
}

export function findCountry(code: string | undefined) {
  return code ? listCountries().find((country) => country.code === code) : undefined;
}
