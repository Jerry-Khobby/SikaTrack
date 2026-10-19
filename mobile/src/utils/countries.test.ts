import { findCountry, listCountries } from './countries';

describe('listCountries', () => {
  it('lists countries sorted by name', () => {
    const names = listCountries().map((country) => country.name);
    expect(names.length).toBeGreaterThan(200);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('gives each country its dialling code and flag', () => {
    expect(findCountry('GH')).toEqual({
      code: 'GH',
      name: 'Ghana',
      dialCode: '+233',
      flag: '🇬🇭',
    });
  });
});

describe('findCountry', () => {
  it('returns undefined for an unknown or missing code', () => {
    expect(findCountry('XX')).toBeUndefined();
    expect(findCountry(undefined)).toBeUndefined();
  });
});
