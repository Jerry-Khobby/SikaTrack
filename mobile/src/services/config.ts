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
  /**
   * ISO 3166 codes of the countries whose MoMo SMS the pipeline can read.
   * Not in the API contract yet; the app expects it to arrive here.
   */
  supportedCountries: string[];
  /** Switches for parts of the app (`features`). */
  features: { budgets: boolean; export: boolean };
};

/** What the server returns today, until the app calls it. */
const DEV_CONFIG: AppConfig = {
  minAppVersion: '1.0.0',
  momoSenders: ['MobileMoney', 'GhanaPay'],
  providers: [
    { code: 'mtn_momo', name: 'MTN MoMo', senders: ['MobileMoney'], supported: true },
    { code: 'ghanapay', name: 'GhanaPay', senders: ['GhanaPay'], supported: true },
    { code: 'telecel_cash', name: 'Telecel Cash', senders: [], supported: false },
  ],
  supportedCountries: ['GH'],
  features: { budgets: true, export: false },
};

let cached: Promise<AppConfig> | undefined;

/** `GET /v1/config`, fetched once per app launch. */
export function getAppConfig() {
  cached ??= Promise.resolve(DEV_CONFIG);
  return cached;
}
