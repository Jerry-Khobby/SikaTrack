import { useEffect, useState } from 'react';

import { getAppConfig, type AppConfig } from '@/services/config';

/** The server config, or undefined while it loads. */
export function useAppConfig() {
  const [config, setConfig] = useState<AppConfig>();

  useEffect(() => {
    let active = true;
    getAppConfig().then((next) => {
      if (active) {
        setConfig(next);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return config;
}
