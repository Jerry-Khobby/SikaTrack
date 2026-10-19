import { act, renderHook } from '@testing-library/react-native';

import { useCountdown } from './use-countdown';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('useCountdown', () => {
  it('counts down once a second and stops at zero', async () => {
    const { result } = await renderHook(() => useCountdown(3));
    expect(result.current.secondsLeft).toBe(3);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(2);

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.secondsLeft).toBe(0);
  });

  it('starts again from a new value on restart', async () => {
    const { result } = await renderHook(() => useCountdown(1));
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current.secondsLeft).toBe(0);

    await act(async () => {
      result.current.restart(60);
    });
    expect(result.current.secondsLeft).toBe(60);
  });
});
