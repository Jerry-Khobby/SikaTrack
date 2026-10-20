import { ApiError, api, toQueryString } from './client';

describe('toQueryString', () => {
  it('skips empty values and repeats array keys', () => {
    expect(
      toQueryString({ from: '2026-10-01', direction: null, q: '', category: ['food', 'bills'], limit: 50 }),
    ).toBe('?from=2026-10-01&category=food&category=bills&limit=50');
  });

  it('encodes values', () => {
    expect(toQueryString({ q: 'chop bar & co' })).toBe('?q=chop%20bar%20%26%20co');
  });

  it('is empty when there is nothing to send', () => {
    expect(toQueryString({})).toBe('');
  });
});

describe('without EXPO_PUBLIC_API_URL', () => {
  it('answers from the dev server, with a not_found problem for unknown paths', async () => {
    await expect(api.get('/v1/nowhere')).rejects.toMatchObject({ status: 404, code: 'not_found' });
    await expect(api.get('/v1/nowhere')).rejects.toBeInstanceOf(ApiError);
  });

  it('can be told to fail, to show error states', async () => {
    process.env.EXPO_PUBLIC_DEV_API_FAILURE = 'true';
    try {
      const error = (await api.get('/v1/categories').catch((e: unknown) => e)) as ApiError;
      expect(error).toBeInstanceOf(ApiError);
      expect(error.requestId).toEqual(expect.any(String));
    } finally {
      delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
    }
  });
});
