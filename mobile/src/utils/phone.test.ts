import { examplePhoneNumber, formatPhoneInput, formatPhoneNumber, parsePhoneNumber } from './phone';

describe('parsePhoneNumber', () => {
  it.each([
    ['024 123 4567', 'with the leading zero'],
    ['24 123 4567', 'without the leading zero'],
    ['+233 24 123 4567', 'pasted with the country code'],
    ['0241234567', 'without spaces'],
  ])('reads %s (%s) as a Ghanaian mobile number', (input) => {
    expect(parsePhoneNumber(input, 'GH')).toBe('+233241234567');
  });

  it('rejects a Ghanaian landline', () => {
    expect(parsePhoneNumber('0302 123 456', 'GH')).toBeNull();
  });

  it('rejects an unfinished number', () => {
    expect(parsePhoneNumber('024 123', 'GH')).toBeNull();
  });

  it("rejects another country's number while Ghana is chosen", () => {
    expect(parsePhoneNumber('+44 7400 123456', 'GH')).toBeNull();
  });

  it('reads numbers for whichever country is chosen', () => {
    expect(parsePhoneNumber('0803 123 4567', 'NG')).toBe('+2348031234567');
  });
});

describe('formatPhoneInput', () => {
  it('spaces a number the way the country writes it', () => {
    expect(formatPhoneInput('0241234567', '', 'GH')).toBe('024 123 4567');
  });

  it('leaves deletions as typed so backspace works', () => {
    expect(formatPhoneInput('024 123', '024 123 ', 'GH')).toBe('024 123');
  });
});

describe('formatPhoneNumber', () => {
  it('writes an E.164 number in international form', () => {
    expect(formatPhoneNumber('+233241234567')).toBe('+233 24 123 4567');
  });

  it('returns anything it cannot read unchanged', () => {
    expect(formatPhoneNumber('not a number')).toBe('not a number');
  });
});

describe('examplePhoneNumber', () => {
  it('gives a sample mobile number for the placeholder', () => {
    const example = examplePhoneNumber('GH');
    expect(example).toBeDefined();
    expect(parsePhoneNumber(example!, 'GH')).not.toBeNull();
  });
});
