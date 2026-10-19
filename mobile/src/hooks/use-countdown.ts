import { useCallback, useEffect, useState } from 'react';

/** Counts whole seconds down to zero. `restart` starts it again from a new value. */
export function useCountdown(seconds: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + seconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const restart = useCallback((nextSeconds: number) => {
    const start = Date.now();
    setNow(start);
    setEndsAt(start + nextSeconds * 1000);
  }, []);

  return { secondsLeft: Math.max(0, Math.ceil((endsAt - now) / 1000)), restart };
}
