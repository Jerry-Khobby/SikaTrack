import { api } from '@/api/client';
import type { ApiConfig } from '@/api/types';

/** The parts of `GET /v1/config` (backend/docs/api-contract.md) the app reads. */
export type Provider = {
  code: string;
  name: string;
  senders: string[];
  supported: boolean;
};

export type AppConfig = {
  minAppVersion: string;
  momoSenders: string[];
  providers: Provider[];
  /** ISO 3166 codes of the countries whose MoMo SMS the pipeline can read. */
  supportedCountries: string[];
  /** The most one SMS upload may hold (`limits`). */
  limits: { smsBatchMaxMessages: number; smsBatchMaxBytes: number };
  /** Switches for parts of the app (`features`). */
  features: { budgets: boolean; export: boolean };
};

const toConfig = (c: ApiConfig): AppConfig => ({
  minAppVersion: c.min_app_version,
  momoSenders: c.momo_senders,
  providers: c.providers,
  supportedCountries: c.supported_countries,
  limits: { smsBatchMaxMessages: c.limits.sms_batch_max_messages, smsBatchMaxBytes: c.limits.sms_batch_max_bytes },
  features: { budgets: c.features.budgets ?? true, export: c.features.export ?? false },
});

let cached: Promise<AppConfig> | undefined;

/**
 * `GET /v1/config`, fetched once per app launch (it's public; no sign-in needed).
 * A failed fetch isn't kept, so the next screen that needs it tries again.
 */
export function getAppConfig() {
  cached ??= api
    .get<ApiConfig>('/v1/config')
    .then(toConfig)
    .catch((error: unknown) => {
      cached = undefined;
      throw error;
    });
  return cached;
}
