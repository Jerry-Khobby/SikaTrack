import { api, usesDevServer } from '@/api/client';
import { startStoredSession } from '@/api/dev-server/me-store';
import type { ApiMe, ApiMePatch, ApiNotifySettings } from '@/api/types';
import { formatMoney } from '@/utils/format';

export type SmsPermission = 'granted' | 'denied';

export type NotifyKey = 'budgets' | 'lowBalance' | 'recurring' | 'weeklySummary' | 'dataReady';

export type Me = {
  phoneNumber: string | null;
  displayName: string | null;
  /** When the account was made, e.g. for "Member since Oct 2026". */
  createdAt: string;
  onboarding: {
    smsPermission: SmsPermission | null;
    walletsAdded: boolean;
    firstSyncDone: boolean;
  };
  settings: {
    notify: Record<NotifyKey, boolean>;
    /** Decimal string, e.g. `"5.00"`. */
    lowBalanceThreshold: string;
    currency: string;
  };
  /** What SikaTrack holds for the account, for S33's summary. */
  data: { transactions: number; firstTransactionAt: string | null; lastTransactionAt: string | null };
};

export type MePatch = {
  displayName?: string | null;
  /** The app only reports SMS access; adding a wallet and the first upload set the rest on the server. */
  onboarding?: { smsPermission?: SmsPermission };
  settings?: { notify?: Partial<Me['settings']['notify']>; lowBalanceThreshold?: string };
};

/** The app's names for the notification switches and the API's. */
const NOTIFY_KEYS: Record<NotifyKey, keyof ApiNotifySettings> = {
  budgets: 'budget',
  lowBalance: 'low_balance',
  recurring: 'recurring',
  weeklySummary: 'weekly_digest',
  dataReady: 'data_ready',
};

const toMe = (m: ApiMe): Me => ({
  phoneNumber: m.phone_number,
  displayName: m.display_name,
  createdAt: m.created_at,
  onboarding: {
    // `unknown` means the app hasn't asked yet.
    smsPermission: m.onboarding.sms_permission === 'unknown' ? null : m.onboarding.sms_permission,
    walletsAdded: m.onboarding.wallets_added,
    firstSyncDone: m.onboarding.first_sync_done,
  },
  settings: {
    notify: Object.fromEntries(
      Object.entries(NOTIFY_KEYS).map(([key, apiKey]) => [key, m.settings.notify[apiKey]]),
    ) as Record<NotifyKey, boolean>,
    lowBalanceThreshold: m.settings.low_balance_threshold,
    currency: m.settings.currency,
  },
  data: {
    transactions: m.data.transactions,
    firstTransactionAt: m.data.first_transaction_at,
    lastTransactionAt: m.data.last_transaction_at,
  },
});

function toApiPatch(patch: MePatch): ApiMePatch {
  const notify = patch.settings?.notify;
  return {
    ...(patch.displayName !== undefined && { display_name: patch.displayName }),
    ...(patch.onboarding?.smsPermission && { onboarding: { sms_permission: patch.onboarding.smsPermission } }),
    ...(patch.settings && {
      settings: {
        ...(patch.settings.lowBalanceThreshold !== undefined && { low_balance_threshold: patch.settings.lowBalanceThreshold }),
        ...(notify && {
          notify: Object.fromEntries(
            Object.entries(notify).map(([key, value]) => [NOTIFY_KEYS[key as NotifyKey], value]),
          ),
        }),
      },
    }),
  };
}

/**
 * Starts a fresh account for this number on the dev server; the sign-in
 * stand-in calls it. The real backend makes the account on sign-in itself.
 */
export function startSession(phoneNumber: string | null) {
  if (usesDevServer) startStoredSession(phoneNumber);
}

/** `GET /v1/me` */
export async function getMe() {
  return toMe(await api.get<ApiMe>('/v1/me'));
}

/** `PATCH /v1/me` */
export async function updateMe(patch: MePatch) {
  return toMe(await api.patch<ApiMe>('/v1/me', toApiPatch(patch)));
}

/**
 * `DELETE /v1/me`: signs out every phone and hides the data at once, and
 * deletes it for good after the grace period. Returns when that happens.
 */
export async function deleteAccount() {
  const response = await api.delete<{ deletion_scheduled_for: string }>('/v1/me');
  return response.deletion_scheduled_for;
}

/**
 * `GET /v1/me/export` (phase 7): asks for a ZIP of the transactions (CSV) and
 * settings (JSON). It's prepared in the background, and a notification brings a
 * time-limited download link. Returns the export's id.
 */
export async function requestExport() {
  const response = await api.get<{ export_id: string }>('/v1/me/export');
  return response.export_id;
}

/** The notification switches with what each one sends, for S10 and S31. */
export function notificationChoices(settings: Me['settings']): { key: NotifyKey; title: string; description: string }[] {
  return [
    { key: 'budgets', title: 'Budget alerts', description: 'When a budget reaches 80% and 100%.' },
    {
      key: 'lowBalance',
      title: 'Low balance',
      description: `When a wallet drops below ${formatMoney(settings.lowBalanceThreshold, settings.currency)}.`,
    },
    {
      key: 'recurring',
      title: 'Recurring payments',
      description: 'New subscriptions, and ones still charging after you planned to cancel.',
    },
    {
      key: 'weeklySummary',
      title: 'Weekly summary',
      description: 'Your week in one message, every Monday.',
    },
    {
      key: 'dataReady',
      title: 'New data ready',
      description: 'When your latest SMS have been processed.',
    },
  ];
}

