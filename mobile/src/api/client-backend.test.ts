/**
 * The app against a real backend (EXPO_PUBLIC_API_URL set), with fetch mocked:
 * the client, sign-in, config and launch.
 */
type Modules = {
  client: typeof import('./client');
  session: typeof import('./session');
  events: typeof import('./system-events');
  auth: typeof import('@/services/auth');
  config: typeof import('@/services/config');
  launch: typeof import('@/services/launch');
  summary: typeof import('@/services/summary');
  counterparties: typeof import('@/services/counterparties');
  balances: typeof import('@/services/balances');
};

/** The mocked fetch; loading React Native installs its own, so load() puts this one back. */
let mockedFetch: typeof fetch | undefined;

/** Fresh copies of the modules, built with EXPO_PUBLIC_API_URL set. */
function load(): Modules {
  let modules!: Modules;
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com';
    modules = {
      client: require('./client'),
      session: require('./session'),
      events: require('./system-events'),
      auth: require('@/services/auth'),
      config: require('@/services/config'),
      launch: require('@/services/launch'),
      summary: require('@/services/summary'),
      counterparties: require('@/services/counterparties'),
      balances: require('@/services/balances'),
    };
  });
  if (mockedFetch) global.fetch = mockedFetch;
  return modules;
}

type FakeResponse = { ok: boolean; status: number; headers: { get: (name: string) => string | null }; json: () => Promise<unknown> };

/** A minimal stand-in for fetch's Response: status, headers and a JSON body. */
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): FakeResponse => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => headers[name] ?? null },
  json: async () => {
    if (body === undefined) throw new Error('no body');
    return body;
  },
});

/** A fetch that answers each `METHOD /path` from a table, in order for repeated calls. */
function backend(routes: Record<string, FakeResponse[]>) {
  const calls: { key: string; init: RequestInit & { headers: Record<string, string> } }[] = [];
  const fetchMock = jest.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
    const key = `${init.method} ${new URL(url).pathname}`;
    calls.push({ key, init });
    const queue = routes[key];
    if (!queue?.length) throw new Error(`unexpected ${key}`);
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    return next;
  });
  mockedFetch = fetchMock as unknown as typeof fetch;
  global.fetch = mockedFetch;
  return calls;
}

const realFetch = global.fetch;

afterEach(() => {
  mockedFetch = undefined;
  global.fetch = realFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  jest.useRealTimers();
});

describe('client with EXPO_PUBLIC_API_URL', () => {
  it('calls the backend with JSON and the bearer token, not the dev server', async () => {
    const calls = backend({ 'PATCH /v1/me': [json({ ok: true })] });
    const { client, session } = load();
    await session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });

    expect(client.usesDevServer).toBe(false);
    await expect(client.api.patch('/v1/me', { display_name: 'Jerry' })).resolves.toEqual({ ok: true });
    expect(calls[0].init.headers.Authorization).toBe('Bearer at_1');
    expect(calls[0].init.body).toBe('{"display_name":"Jerry"}');
  });

  it('turns a problem response into an ApiError with the request ID', async () => {
    backend({
      'POST /v1/wallets': [json({ status: 422, code: 'unsupported_provider', title: 'Not yet' }, 422, { 'X-Request-ID': 'req-9' })],
    });
    const { client } = load();
    await expect(client.api.post('/v1/wallets', {})).rejects.toMatchObject({
      status: 422,
      code: 'unsupported_provider',
      requestId: 'req-9',
    });
  });

  it('refreshes an expired access token once and retries, sharing one refresh between requests', async () => {
    const calls = backend({
      'GET /v1/summary': [
        json({ status: 401, code: 'unauthenticated' }, 401),
        json({ status: 401, code: 'unauthenticated' }, 401),
        json({ money_out: '1.00' }),
      ],
      'POST /v1/auth/refresh': [json({ access_token: 'at_2', refresh_token: 'rt_2', expires_in: 900 })],
    });
    const { client, session } = load();
    await session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });

    const [a, b] = await Promise.all([client.api.get('/v1/summary'), client.api.get('/v1/summary')]);
    expect(a).toEqual({ money_out: '1.00' });
    expect(b).toEqual({ money_out: '1.00' });
    expect(calls.filter((c) => c.key === 'POST /v1/auth/refresh')).toHaveLength(1);
    expect(calls.find((c) => c.key === 'POST /v1/auth/refresh')!.init.body).toBe('{"refresh_token":"rt_1"}');
    expect(calls.at(-1)!.init.headers.Authorization).toBe('Bearer at_2');
    expect(session.getRefreshToken()).toBe('rt_2');
  });

  it('ends the session when the refresh is refused, and says so', async () => {
    backend({
      'GET /v1/me': [json({ status: 401, code: 'unauthenticated' }, 401)],
      'POST /v1/auth/refresh': [json({ status: 401, code: 'refresh_invalid', title: 'Please sign in again' }, 401)],
    });
    const { client, session, events } = load();
    await session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });
    const seen: string[] = [];
    const stop = events.onSystemEvent((e) => seen.push(e.type));

    await expect(client.api.get('/v1/me')).rejects.toMatchObject({ code: 'refresh_invalid' });
    expect(session.isSignedIn()).toBe(false);
    expect(seen).toEqual(['session_expired']);
    stop();
  });

  it('gives up on a request with no answer after 20 seconds', async () => {
    jest.useFakeTimers();
    mockedFetch = jest.fn(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
    ) as unknown as typeof fetch;
    const { client } = load();

    const pending = client.api.get('/v1/summary').catch((e: unknown) => e);
    jest.advanceTimersByTime(20_000);
    await expect(pending).resolves.toMatchObject({ status: 0, code: 'network_unavailable' });
  });
});

const me = (onboarding: object) => ({
  id: 'usr_1',
  phone_number: '+233241234567',
  display_name: null,
  created_at: '2026-10-01T00:00:00Z',
  onboarding: { wallets_added: false, sms_permission: 'unknown', first_sync_done: false, ...onboarding },
  settings: { low_balance_threshold: '5.00', notify: {}, currency: 'GHS' },
  data: { first_transaction_at: null, last_transaction_at: null, transactions: 0 },
});

describe('sign-in against the backend', () => {
  it('asks for a code and signs in with this phone’s device, keeping the tokens', async () => {
    const calls = backend({
      'POST /v1/auth/otp/request': [json({ otp_request_id: 'otp_1', expires_in: 300, resend_after: 60 }, 202)],
      'POST /v1/auth/otp/verify': [
        json({ access_token: 'at_1', refresh_token: 'rt_1', expires_in: 900, is_new_user: true, user: me({}) }),
      ],
    });
    const { auth, session } = load();

    await expect(auth.requestOtp('+233241234567')).resolves.toEqual({ otpRequestId: 'otp_1', expiresIn: 300, resendAfter: 60 });
    await expect(auth.verifyOtp('otp_1', '123456')).resolves.toEqual({ isNewUser: true, onboardingFinished: false });

    const verify = JSON.parse(String(calls[1].init.body));
    expect(verify).toMatchObject({ otp_request_id: 'otp_1', code: '123456', device: { platform: 'android' } });
    expect(verify.device.device_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.getRefreshToken()).toBe('rt_1');
  });

  it('turns the backend’s errors into the ones the screens explain', async () => {
    backend({
      'POST /v1/auth/otp/request': [
        json({ status: 429, code: 'rate_limited' }, 429, { 'Retry-After': '300' }),
        json({ status: 400, code: 'validation_error' }, 400),
      ],
      'POST /v1/auth/otp/verify': [json({ status: 400, code: 'otp_invalid' }, 400)],
    });
    const { auth } = load();

    await expect(auth.requestOtp('+233241234567')).rejects.toMatchObject({ retryAfterMinutes: 5 });
    await expect(auth.requestOtp('123')).rejects.toBeInstanceOf(auth.InvalidPhoneError);
    await expect(auth.verifyOtp('otp_1', '000000')).rejects.toBeInstanceOf(auth.OtpInvalidError);
  });

  it('signs out with the refresh token and forgets the session', async () => {
    const calls = backend({ 'POST /v1/auth/logout': [json(undefined, 204)] });
    const { auth, session } = load();
    await session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });

    await auth.signOut();
    expect(calls[0].init.body).toBe('{"refresh_token":"rt_1"}');
    expect(session.isSignedIn()).toBe(false);
  });

  it("signs out on the phone without an error when the server can't be reached", async () => {
    mockedFetch = jest.fn(async () => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;
    global.fetch = mockedFetch;
    const { auth, session } = load();
    await session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });

    await expect(auth.signOut()).resolves.toBeUndefined();
    expect(session.isSignedIn()).toBe(false);
  });
});

describe('Google sign-in against the backend', () => {
  const google = () => jest.requireMock('@react-native-google-signin/google-signin').GoogleSignin;
  const tokens = { access_token: 'at_g', refresh_token: 'rt_g', token_type: 'Bearer', expires_in: 900, is_new_user: true };
  const me = { onboarding: { wallets_added: false, sms_permission: 'unknown', first_sync_done: false } };

  it("sends Google's ID token and this phone, and keeps the tokens", async () => {
    const calls = backend({ 'POST /v1/auth/google': [json({ ...tokens, user: me })] });
    const { auth, session } = load();

    const result = await auth.signInWithGoogle();

    expect(google().configure).toHaveBeenCalledWith({ webClientId: 'web-client.apps.googleusercontent.com' });
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.id_token).toBe('google-id-token');
    expect(body.device).toMatchObject({ platform: 'android' });
    expect(result).toEqual({ isNewUser: true, onboardingFinished: false });
    expect(session.isSignedIn()).toBe(true);
  });

  it('does nothing when the person closes Google’s account picker', async () => {
    const calls = backend({});
    google().signIn.mockResolvedValueOnce({ type: 'cancelled', data: null });
    const { auth } = load();

    expect(await auth.signInWithGoogle()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('says so when the server can’t confirm the Google account', async () => {
    backend({ 'POST /v1/auth/google': [json({ status: 401, code: 'google_token_invalid', title: 'x' }, 401)] });
    const { auth } = load();

    await expect(auth.signInWithGoogle()).rejects.toBeInstanceOf(auth.GoogleSignInFailedError);
  });

  it('reads which ways to sign in from the config', async () => {
    backend({ 'GET /v1/config': [json({ ...require('@/api/dev-server/catalog').DEV_CONFIG, sign_in_methods: ['google'] })] });
    const { config } = load();

    expect((await config.getAppConfig()).signInMethods).toEqual(['google']);
  });
});

describe('config and launch against the backend', () => {
  const config = (minAppVersion: string) =>
    json({
      min_app_version: minAppVersion,
      momo_senders: ['MobileMoney'],
      providers: [{ code: 'mtn_momo', name: 'MTN MoMo', senders: ['MobileMoney'], supported: true }],
      supported_countries: ['GH'],
      limits: { sms_batch_max_messages: 500, sms_batch_max_bytes: 1048576 },
      features: { budgets: true, export: false },
    });

  it('reads the config once', async () => {
    const calls = backend({ 'GET /v1/config': [config('1.0.0')] });
    const { config: service } = load();

    const first = await service.getAppConfig();
    await service.getAppConfig();
    expect(first.supportedCountries).toEqual(['GH']);
    expect(calls).toHaveLength(1);
  });

  it('compares versions part by part', () => {
    const { isOlderThan } = load().launch;
    expect(isOlderThan('1.0.0', '99.0.0')).toBe(true);
    expect(isOlderThan('1.10.0', '1.9.3')).toBe(false);
    expect(isOlderThan('1.2.0', '1.2.0')).toBe(false);
  });

  it('sends nobody signed in to Welcome, and a saved session Home or back into onboarding', async () => {
    backend({
      'GET /v1/config': [config('1.0.0')],
      'GET /v1/me': [
        json(me({ sms_permission: 'granted', wallets_added: true, first_sync_done: true })),
        json(me({ sms_permission: 'granted' })),
      ],
    });
    const modules = load();
    await modules.session.clearSession();
    await expect(modules.launch.getLaunchDestination()).resolves.toBe('/welcome');

    await modules.session.saveSession({ accessToken: 'at_1', refreshToken: 'rt_1' });
    await expect(modules.launch.getLaunchDestination()).resolves.toBe('/home');
    await expect(modules.launch.getLaunchDestination()).resolves.toBe('/onboarding/wallets');
  });
});

describe('the backend’s empty fields', () => {
  const tx = {
    id: 'txn_1', status: 'final', occurred_at: '2026-10-01T09:00:00Z', provider: null, wallet_id: null, type: null,
    direction: 'out', amount: '1.00', fee: '0.00', tax: '0.00', total_cost: '0.00', balance_after: null,
    currency: 'GHS', category: null, category_source: 'rule', counterparty: null, reference: null, note: null,
    is_own_transfer: false, recurring_id: null, flags: [],
  };

  it('shows an uncategorised, unnamed transaction instead of breaking', async () => {
    const { toTransaction } = require('@/services/transactions') as typeof import('@/services/transactions');
    const t = toTransaction(tx as never);
    expect(t.category).toEqual({ id: 'uncategorized', name: 'Uncategorized', group: 'spending' });
    expect(t.counterparty).toEqual({ id: '', name: 'Unknown', kind: 'unknown' });
    expect(t.provider).toBe('');
    expect(t.type).toBeNull();
  });

  it('reads empty habits, a counterparty’s category object and a balance without a wallet', async () => {
    backend({
      'GET /v1/summary/habits': [
        json({ grid: [], by_hour: [], peak: { weekday: null, day_part: null }, weekend_share: null, median_payment: null }),
      ],
      'GET /v1/counterparties/cpt_1': [
        json({
          id: 'cpt_1', name: 'Papaye', original_name: 'PAPAYE', alias: null, kind: 'merchant',
          default_category: { id: 'food', name: 'Food', group: 'spending' }, money_out: '10.00', transactions: 1,
          last_seen_at: null,
        }),
      ],
      'GET /v1/balances/history': [
        json({ items: [{ date: '2026-10-01', wallet_id: null, provider: 'mtn_momo', balance: '4.00' }], days_below_threshold: 1, threshold: '5.00' }),
      ],
    });
    const { summary, counterparties, balances } = load();

    await expect(summary.getHabits('2026-10')).resolves.toMatchObject({ peak: null, weekendShare: '0', medianPayment: '0.00' });
    await expect(counterparties.getCounterparty('cpt_1')).resolves.toMatchObject({ defaultCategory: 'food', lastSeenAt: null });
    await expect(balances.daysBelow('5.00', { from: '2026-10-01', to: '2026-10-31' })).resolves.toBe(1);
  });
});
