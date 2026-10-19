/**
 * Stand-in for `GET /v1/me` and `PATCH /v1/me` until the backend is wired in.
 * Held in memory, so it starts over when the app reloads.
 */

export type SmsPermission = 'granted' | 'denied';

export type NotifyKey = 'budgets' | 'lowBalance' | 'recurring' | 'weeklySummary' | 'dataReady';

export type Me = {
  phoneNumber: string | null;
  displayName: string | null;
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
};

export type MePatch = {
  displayName?: string | null;
  onboarding?: Partial<Me['onboarding']>;
  settings?: { notify?: Partial<Me['settings']['notify']> };
};

/** A new account, with the server's default settings. */
function newAccount(phoneNumber: string | null): Me {
  return {
    phoneNumber,
    displayName: null,
    onboarding: { smsPermission: null, walletsAdded: false, firstSyncDone: false },
    settings: {
      notify: {
        budgets: true,
        lowBalance: true,
        recurring: true,
        weeklySummary: true,
        dataReady: false,
      },
      lowBalanceThreshold: '5.00',
      currency: 'GHS',
    },
  };
}

let me = newAccount(null);

const copy = (value: Me): Me => JSON.parse(JSON.stringify(value));

/** Starts a fresh account for this number; the sign-in stand-in calls it. */
export function startSession(phoneNumber: string | null) {
  me = newAccount(phoneNumber);
}

/** `GET /v1/me` */
export async function getMe() {
  return copy(me);
}

/** `PATCH /v1/me` */
export async function updateMe(patch: MePatch) {
  me = {
    ...me,
    displayName: patch.displayName !== undefined ? patch.displayName : me.displayName,
    onboarding: { ...me.onboarding, ...patch.onboarding },
    settings: {
      ...me.settings,
      notify: { ...me.settings.notify, ...patch.settings?.notify },
    },
  };
  return copy(me);
}
