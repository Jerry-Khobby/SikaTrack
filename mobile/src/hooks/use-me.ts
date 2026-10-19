import { useEffect, useState } from 'react';

import { getMe, type Me } from '@/services/me';

/** The signed-in user, or undefined while it loads. */
export function useMe() {
  const [me, setMe] = useState<Me>();

  useEffect(() => {
    let active = true;
    getMe().then((next) => {
      if (active) {
        setMe(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return me;
}
