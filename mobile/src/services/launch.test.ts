import { getLaunchDestination } from './launch';

describe('getLaunchDestination', () => {
  const original = process.env.EXPO_PUBLIC_FORCE_UPDATE;

  afterEach(() => {
    process.env.EXPO_PUBLIC_FORCE_UPDATE = original;
  });

  it('sends a signed-out user to Welcome', async () => {
    delete process.env.EXPO_PUBLIC_FORCE_UPDATE;
    await expect(getLaunchDestination()).resolves.toBe('/welcome');
  });

  it('sends everyone to Update required when forced', async () => {
    process.env.EXPO_PUBLIC_FORCE_UPDATE = 'true';
    await expect(getLaunchDestination()).resolves.toBe('/update-required');
  });
});
