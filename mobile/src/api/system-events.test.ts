import { onlineManager } from '@tanstack/react-query';

import { getMe } from '@/services/me';

import { createQueryClient } from './query-client';
import { onSystemEvent, type SystemEvent } from './system-events';

let events: SystemEvent[];
let stop: () => void;

beforeEach(() => {
  events = [];
  stop = onSystemEvent((event) => events.push(event));
});

afterEach(() => {
  stop();
  delete process.env.EXPO_PUBLIC_DEV_API_FAILURE;
  onlineManager.setOnline(true);
});

async function failWith(mode: string) {
  process.env.EXPO_PUBLIC_DEV_API_FAILURE = mode;
  await getMe().catch(() => undefined);
}

describe('app-wide errors', () => {
  it('reports a lost session, a slow-down with its wait, and an old app', async () => {
    await failWith('session_expired');
    await failWith('rate_limited');
    await failWith('update_required');
    expect(events).toEqual([
      { type: 'session_expired' },
      { type: 'rate_limited', retryAfter: 30 },
      { type: 'update_required' },
    ]);
  });

  it('leaves other errors to their screen', async () => {
    await failWith('true');
    expect(events).toEqual([]);
  });

  it('reports the servers away only when a screen has nothing saved to show', async () => {
    process.env.EXPO_PUBLIC_DEV_API_FAILURE = 'unavailable';
    const client = createQueryClient();
    const options = { queryKey: ['me'], queryFn: getMe, retry: false } as const;

    await client.fetchQuery(options).catch(() => undefined);
    expect(events).toEqual([{ type: 'unavailable' }]);

    // With data already there, the saved screen stays usable.
    events = [];
    client.setQueryData(['me'], { displayName: 'Saved' });
    await client.refetchQueries({ queryKey: ['me'] });
    expect(events).toEqual([]);
  });
});
