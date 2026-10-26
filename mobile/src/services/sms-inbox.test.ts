/**
 * Reading the phone's MoMo SMS in a build with the app's SMS module, against a real backend:
 * the native module is faked with an inbox, fetch with the backend's answers.
 */
import type { ApiConfig } from '@/api/types';

import type { InboxSms } from './sms-inbox';

type Modules = {
  inbox: typeof import('./sms-inbox');
  sms: typeof import('./sms');
  sync: typeof import('./sync');
  permissions: typeof import('./permissions');
  rn: typeof import('react-native');
};

const MOMO = 'MobileMoney';

/** A fake of modules/sms-inbox over a list of messages, with the same filtering and paging. */
function fakeNative(messages: InboxSms[]) {
  const match = (senders: string[], sinceMs: number) => (m: InboxSms) =>
    senders.includes(m.sender) && Number(m.dateMs) > sinceMs;
  const sorted = [...messages].sort((a, b) => Number(a.dateMs) - Number(b.dateMs) || a.id - b.id);
  return {
    count: jest.fn(async (senders: string[], sinceMs: number) => sorted.filter(match(senders, sinceMs)).length),
    read: jest.fn(async (senders: string[], sinceMs: number, afterDateMs: string | null, afterId: number, limit: number) =>
      sorted
        .filter(match(senders, sinceMs))
        .filter(
          (m) =>
            afterDateMs === null ||
            Number(m.dateMs) > Number(afterDateMs) ||
            (m.dateMs === afterDateMs && m.id > afterId),
        )
        .slice(0, limit),
    ),
  };
}

let mockedFetch: typeof fetch | undefined;

/** Fresh modules on "Android", with EXPO_PUBLIC_API_URL set and the SMS module present. */
function load(native: ReturnType<typeof fakeNative> | null): Modules {
  let modules!: Modules;
  jest.isolateModules(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test/';
    const rn = require('react-native');
    rn.Platform.OS = 'android';
    jest.doMock('expo', () => ({ ...jest.requireActual('expo'), requireOptionalNativeModule: () => native }));
    modules = {
      inbox: require('./sms-inbox'),
      sms: require('./sms'),
      sync: require('./sync'),
      permissions: require('./permissions'),
      rn,
    };
  });
  if (mockedFetch) global.fetch = mockedFetch;
  // SMS allowed unless a test says otherwise.
  jest.spyOn(modules.rn.PermissionsAndroid, 'check').mockResolvedValue(true);
  return modules;
}

type Upload = { device_id: string; source: string; messages: { sender: string; date_ms: string; body: string }[] };
type Call = { key: string; headers: Record<string, string>; body?: Upload };

/**
 * The backend: config with a small batch limit, and an upload endpoint that counts a message
 * as a payment when it says "paid". `fail` answers instead of the upload with that index.
 */
function backend({ maxMessages = 2, fail = {} as Record<number, () => Promise<Response>> } = {}) {
  const config: ApiConfig = {
    ...require('@/api/dev-server/catalog').DEV_CONFIG,
    limits: { sms_batch_max_messages: maxMessages, sms_batch_max_bytes: 1_048_576 },
  };
  const calls: Call[] = [];
  let uploads = 0;
  const respond = (body: unknown, status = 200) =>
    ({ ok: status < 300, status, headers: { get: () => null }, json: async () => body }) as unknown as Response;
  const fetchMock = jest.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
    const key = `${init.method} ${new URL(url).pathname}`;
    const body = init.body ? (JSON.parse(String(init.body)) as Upload) : undefined;
    calls.push({ key, headers: init.headers, body });
    if (key === 'GET /v1/config') return respond(config);
    if (key !== 'POST /v1/sms/batches' || !body) throw new Error(`unexpected ${key}`);
    const failure = fail[uploads++];
    if (failure) return failure();
    const parsed = body.messages.filter((m) => m.body.includes('paid')).length;
    return respond(
      {
        batch_id: `bat_${uploads}`,
        received: body.messages.length,
        accepted: body.messages.length,
        duplicates: 0,
        rejected_senders: 0,
        parsed,
        unparsed: 0,
        ignored: body.messages.length - parsed,
        provisional_transactions: parsed,
        sync: { latest_date_ms: body.messages.at(-1)!.date_ms, pipeline: 'scheduled' },
      },
      202,
    );
  });
  mockedFetch = fetchMock as unknown as typeof fetch;
  global.fetch = mockedFetch;
  return { calls, uploads: () => calls.filter((c) => c.key === 'POST /v1/sms/batches') };
}

const day = (n: number) => String(Date.UTC(2026, 0, n, 9));
const message = (id: number, dateMs: string, body: string, sender = MOMO): InboxSms => ({ id, sender, dateMs, body });

const INBOX = [
  message(1, day(3), 'You have paid GHS 5.00 to MTN AIRTIME'),
  message(2, day(4), 'Your code is 1234'),
  message(3, day(5), 'You have paid GHS 40.00 to SUNSHINE LAUNDRY'),
  message(4, day(6), 'Hi, are we still meeting?', 'Kofi'),
  message(5, day(7), 'You have paid GHS 16.50 to AMA SERWAA'),
];

/** Waits until the scan stops running. */
async function settled(sms: Modules['sms']) {
  for (let i = 0; i < 200 && sms.getScanState().status === 'running'; i++) await new Promise((r) => setTimeout(r, 5));
  return sms.getScanState();
}

const realFetch = global.fetch;

afterEach(() => {
  mockedFetch = undefined;
  global.fetch = realFetch;
  delete process.env.EXPO_PUBLIC_API_URL;
  jest.restoreAllMocks();
});

describe('batches', () => {
  it('splits by the message limit and by the byte limit', () => {
    const { inbox } = load(fakeNative([]));
    const messages = [1, 2, 3, 4, 5].map((i) => message(i, day(i), 'x'.repeat(400)));
    expect(inbox.toBatches(messages, { maxMessages: 2, maxBytes: 1_048_576 }).map((b) => b.length)).toEqual([2, 2, 1]);
    // ~450 bytes a message and 1 KB kept for the rest of the body: three fit in 2,500 bytes, not four.
    expect(inbox.toBatches(messages, { maxMessages: 500, maxBytes: 2500 }).map((b) => b.length)).toEqual([3, 2]);
  });
});

describe('first sync on a phone', () => {
  it('uploads only the MoMo SMS, oldest first, in batches the server accepts', async () => {
    const native = fakeNative(INBOX);
    const server = backend();
    const { sms } = load(native);

    sms.startInitialScan();
    const state = await settled(sms);

    expect(state).toMatchObject({ status: 'done', found: 4, total: 4, parsed: 3, ignored: 1, firstTransactionAt: '2026-01-03' });
    const uploads = server.uploads();
    expect(uploads.map((u) => u.body!.messages.map((m) => m.body.slice(0, 18)))).toEqual([
      ['You have paid GHS ', 'Your code is 1234'],
      ['You have paid GHS ', 'You have paid GHS '],
    ]);
    expect(uploads.every((u) => u.body!.source === 'initial_scan' && u.body!.device_id)).toBe(true);
    expect(uploads.flatMap((u) => u.body!.messages).every((m) => m.sender === MOMO)).toBe(true);
    expect(uploads[0].body!.messages[0].date_ms).toBe(day(3));
    expect(new Set(uploads.map((u) => u.headers['Idempotency-Key'])).size).toBe(2);
    // Only the senders from config are asked for.
    expect(native.read).toHaveBeenCalledWith(['MobileMoney', 'GhanaPay'], 0, null, 0, 200);
  });

  it('carries on after the last batch the server took when an upload fails', async () => {
    const refused = async () =>
      ({ ok: false, status: 400, headers: { get: () => null }, json: async () => ({ status: 400, code: 'validation_error' }) }) as unknown as Response;
    const server = backend({ fail: { 1: refused } });
    const { sms } = load(fakeNative(INBOX));

    sms.startInitialScan();
    expect(await settled(sms)).toMatchObject({ status: 'failed', found: 2, total: 4 });

    sms.startInitialScan();
    expect(await settled(sms)).toMatchObject({ status: 'done', found: 4, parsed: 3, ignored: 1 });
    const sent = server.uploads().map((u) => u.body!.messages.length);
    // The first batch once, the refused second one, then the second one again.
    expect(sent).toEqual([2, 2, 2]);
  });

  it('retries a dropped upload with the same Idempotency-Key', async () => {
    const server = backend({ maxMessages: 500, fail: { 0: async () => Promise.reject(new TypeError('Network request failed')) } });
    const { sms } = load(fakeNative(INBOX));

    sms.startInitialScan();
    for (let i = 0; i < 100 && server.uploads().length < 2; i++) await new Promise((r) => setTimeout(r, 50));
    expect(await settled(sms)).toMatchObject({ status: 'done', found: 4 });
    const [first, second] = server.uploads();
    expect(second.headers['Idempotency-Key']).toBe(first.headers['Idempotency-Key']);
  }, 10_000);

  it("asks for the SMS permission when it's missing, and stops without uploading if refused", async () => {
    const server = backend();
    const { sms, rn } = load(fakeNative(INBOX));
    jest.spyOn(rn.PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest.spyOn(rn.PermissionsAndroid, 'request').mockResolvedValue('never_ask_again');

    sms.startInitialScan();
    expect(await settled(sms)).toMatchObject({ status: 'failed', problem: 'permission', found: 0 });
    expect(request).toHaveBeenCalledWith('android.permission.READ_SMS');
    expect(server.uploads()).toHaveLength(0);

    // Allowed on the next try: the scan runs.
    request.mockResolvedValue('granted');
    sms.startInitialScan();
    expect(await settled(sms)).toMatchObject({ status: 'done', found: 4, problem: null });
  });

  it('finishes at once on a phone with no MoMo SMS', async () => {
    const server = backend();
    const { sms } = load(fakeNative([message(1, day(1), 'hello', 'Kofi')]));

    sms.startInitialScan();
    expect(await settled(sms)).toMatchObject({ status: 'done', total: 0, found: 0 });
    expect(server.uploads()).toHaveLength(0);
  });
});

describe('Sync now on a phone', () => {
  it("sends what came after the server's newest SMS, less ten minutes, as incremental", async () => {
    const native = fakeNative(INBOX);
    const server = backend();
    const { sync } = load(native);

    const latest = String(Number(day(5)) + 5 * 60 * 1000);
    const accepted = await sync.syncNow({ latestDateMs: latest });

    // Day 5 is within the ten-minute overlap, so it's sent again; the server skips duplicates.
    expect(native.read).toHaveBeenCalledWith(['MobileMoney', 'GhanaPay'], Number(latest) - 10 * 60 * 1000, null, 0, 200);
    expect(server.uploads().map((u) => u.body!.source)).toEqual(['incremental']);
    expect(server.uploads()[0].body!.messages.map((m) => m.date_ms)).toEqual([day(5), day(7)]);
    expect(accepted).toBe(2);
  });
});

describe('the SMS permission', () => {
  it("asks Android's READ_SMS prompt in a build that can read SMS", async () => {
    const { permissions, rn } = load(fakeNative([]));
    const request = jest.spyOn(rn.PermissionsAndroid, 'request').mockResolvedValue('denied');
    jest.spyOn(rn.PermissionsAndroid, 'check').mockResolvedValue(false);

    expect(await permissions.requestSmsPermission()).toBe('denied');
    expect(request).toHaveBeenCalledWith('android.permission.READ_SMS');
    expect(await permissions.hasSmsPermission()).toBe(false);

    request.mockResolvedValue('granted');
    expect(await permissions.requestSmsPermission()).toBe('granted');
  });

  it('says yes without asking in Expo Go, where the module is missing', async () => {
    const { permissions, rn, inbox } = load(null);
    const request = jest.spyOn(rn.PermissionsAndroid, 'request');

    expect(inbox.canReadSms).toBe(false);
    expect(await permissions.requestSmsPermission()).toBe('granted');
    expect(request).not.toHaveBeenCalled();
  });
});
