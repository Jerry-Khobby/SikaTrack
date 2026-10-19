import { getMe, startSession } from './me';
import { getScanState, resetScan, startInitialScan, subscribeToScan } from './sms';

const original = process.env.EXPO_PUBLIC_EMPTY_INBOX;

beforeEach(() => {
  jest.useFakeTimers();
  startSession('+233241234567');
  resetScan();
});

afterEach(() => {
  resetScan();
  jest.useRealTimers();
  process.env.EXPO_PUBLIC_EMPTY_INBOX = original;
});

describe('first sync stand-in', () => {
  it('counts up while running and marks the first sync done at the end', async () => {
    const listener = jest.fn();
    subscribeToScan(listener);

    startInitialScan();
    expect(getScanState().status).toBe('running');

    jest.advanceTimersByTime(3000);
    const midway = getScanState();
    expect(midway.found).toBeGreaterThan(0);
    expect(midway.found).toBeLessThan(midway.total);

    jest.advanceTimersByTime(4000);
    const done = getScanState();
    expect(done.status).toBe('done');
    expect(done.found).toBe(done.total);
    expect(done.parsed + done.ignored).toBe(done.total);
    expect(listener).toHaveBeenCalled();
    expect((await getMe()).onboarding.firstSyncDone).toBe(true);
  });

  it('starts only once', () => {
    startInitialScan();
    jest.advanceTimersByTime(1000);
    const found = getScanState().found;

    startInitialScan();

    expect(getScanState().found).toBe(found);
  });

  it('finishes straight away when the phone has no MoMo SMS', () => {
    process.env.EXPO_PUBLIC_EMPTY_INBOX = 'true';

    startInitialScan();

    expect(getScanState()).toMatchObject({ status: 'done', total: 0, parsed: 0 });
  });
});
