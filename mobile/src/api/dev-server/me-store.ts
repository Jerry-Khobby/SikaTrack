/**
 * The signed-in account behind `GET`/`PATCH`/`DELETE /v1/me`, held in memory
 * like the rest of the dev server. Every sign-in starts a fresh account.
 */
import type { ApiMe, ApiMePatch } from '../types';
import { LOW_BALANCE_THRESHOLD } from './catalog';

export type StoredMe = Omit<ApiMe, 'data'> & {
  /** Set by `DELETE /v1/me`: when the account goes for good. */
  deletionScheduledFor: string | null;
};

/** How long a deleted account waits before it's gone, so signing in again can save it. */
export const DELETION_GRACE_DAYS = 7;

function newAccount(phoneNumber: string | null): StoredMe {
  return {
    id: `usr_dev_${Math.random().toString(36).slice(2, 8)}`,
    phone_number: phoneNumber,
    display_name: null,
    created_at: new Date().toISOString(),
    onboarding: { wallets_added: false, sms_permission: 'unknown', first_sync_done: false },
    settings: {
      low_balance_threshold: LOW_BALANCE_THRESHOLD,
      notify: { budget: true, low_balance: true, recurring: true, weekly_digest: true, data_ready: false },
      currency: 'GHS',
    },
    deletionScheduledFor: null,
  };
}

let me = newAccount(null);

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function storedMe() {
  return copy(me);
}

/** Starts a new account for this number, as signing in does. */
export function startStoredSession(phoneNumber: string | null) {
  me = newAccount(phoneNumber);
}

export function patchStoredMe(patch: ApiMePatch) {
  me = {
    ...me,
    display_name: patch.display_name !== undefined ? patch.display_name : me.display_name,
    onboarding: { ...me.onboarding, ...patch.onboarding },
    settings: {
      ...me.settings,
      low_balance_threshold: patch.settings?.low_balance_threshold ?? me.settings.low_balance_threshold,
      notify: { ...me.settings.notify, ...patch.settings?.notify },
    },
  };
  return storedMe();
}

/** What the server records by itself: a wallet was added, or the first scan was uploaded. */
export function markOnboarding(step: 'wallets_added' | 'first_sync_done') {
  me.onboarding = { ...me.onboarding, [step]: true };
}

/** `DELETE /v1/me`: schedules the deletion and returns when it happens. */
export function scheduleStoredDeletion(now = Date.now()) {
  me.deletionScheduledFor = new Date(now + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  return me.deletionScheduledFor;
}

/** The user's low-balance amount, which the balance routes and notifications compare with. */
export function lowBalanceThreshold() {
  return me.settings.low_balance_threshold;
}
