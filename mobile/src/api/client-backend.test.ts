/**
 * The client against a real backend (EXPO_PUBLIC_API_URL set), with fetch mocked.
 */
type Client = typeof import('./client');

function loadClient(): Client {
  let client!: Client;
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
    client = require('./client');
  });
  return client;
}

const realFetch = global.fetch;

afterEach(() => {
  global.fetch = realFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
  jest.useRealTimers();
});

describe('with EXPO_PUBLIC_API_URL', () => {
  it('calls the backend with JSON and the bearer token, not the dev server', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    global.fetch = fetchMock;
    const client = loadClient();
    client.setAccessToken('at_123');

    expect(client.usesDevServer).toBe(false);
    await expect(client.api.patch('/v1/me', { display_name: 'Jerry' })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/v1/me');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe('Bearer at_123');
    expect(init.body).toBe('{"display_name":"Jerry"}');
  });

  it('turns a problem response into an ApiError with the request ID', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 422, code: 'unsupported_provider', title: 'Not yet' }), {
        status: 422,
        headers: { 'X-Request-ID': 'req-9' },
      }),
    );
    const client = loadClient();

    await expect(client.api.post('/v1/wallets', {})).rejects.toMatchObject({
      status: 422,
      code: 'unsupported_provider',
      requestId: 'req-9',
    });
  });

  it('gives up on a request with no answer after 20 seconds', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as unknown as typeof fetch;
    const client = loadClient();

    const pending = client.api.get('/v1/summary').catch((e: unknown) => e);
    jest.advanceTimersByTime(20_000);
    await expect(pending).resolves.toMatchObject({ status: 0, code: 'network_unavailable' });
  });
});
