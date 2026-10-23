/**
 * The first sync (docs/ui-spec.md S09): read the MoMo SMS on the phone and upload
 * them in batches. A build that can read SMS does it for real (sms-inbox.ts); Expo
 * Go and the dev server play a scan of the dataset the pipeline was built on (see
 * data-engineering/README.md). Start with EXPO_PUBLIC_EMPTY_INBOX=true to see a
 * phone with no MoMo SMS.
 */
import { api, usesDevServer } from '@/api/client';

import { getAppConfig } from './config';
import { canReadSms, countInbox, readInbox, toBatches, uploadBatch, type InboxSms } from './sms-inbox';

export type ScanState = {
  /** `failed`: an upload didn't go through; starting again carries on from there. */
  status: 'idle' | 'running' | 'done' | 'failed';
  /** MoMo SMS read so far. */
  found: number;
  /** Turned into transactions (`parsed`). */
  parsed: number;
  /** Codes, promotions and other non-transactions (`ignored`). */
  ignored: number;
  /** MoMo SMS on the phone in total. */
  total: number;
  /** Date of the oldest transaction, `YYYY-MM-DD`. */
  firstTransactionAt: string | null;
};

const DEV_INBOX = { parsed: 1964, ignored: 619, firstTransactionAt: '2025-11-01' };
const SCAN_MS = 6000;
const TICK_MS = 200;

const IDLE: ScanState = {
  status: 'idle',
  found: 0,
  parsed: 0,
  ignored: 0,
  total: 0,
  firstTransactionAt: null,
};

let state = IDLE;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function set(next: ScanState) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function getScanState() {
  return state;
}

export function subscribeToScan(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Starts the scan once; later calls do nothing, except after a failed upload, when the next
 * call carries on from there. It keeps going after its screen closes.
 */
export function startInitialScan() {
  if (state.status === 'running' || state.status === 'done') return;
  if (canReadSms && !usesDevServer) {
    scanInbox().catch(() => set({ ...state, status: 'failed' }));
    return;
  }

  // Expo Go can't read SMS, so against a real backend it finds none.
  const inbox =
    !usesDevServer || process.env.EXPO_PUBLIC_EMPTY_INBOX === 'true'
      ? { parsed: 0, ignored: 0, firstTransactionAt: null }
      : DEV_INBOX;
  const total = inbox.parsed + inbox.ignored;

  const finish = () => {
    set({ ...state, status: 'done', found: total, parsed: inbox.parsed, ignored: inbox.ignored });
    // The dev server marks the first sync done on an `initial_scan` upload, as the backend does.
    // The stand-in has no real SMS, so it sends an empty one; the real backend needs at least one
    // message, which the SMS reader in a development build will send.
    if (usesDevServer) api.post('/v1/sms/batches', { source: 'initial_scan', messages: [] }).catch(() => undefined);
  };

  set({ ...IDLE, status: 'running', total, firstTransactionAt: inbox.firstTransactionAt });
  if (total === 0) {
    finish();
    return;
  }

  const startedAt = Date.now();
  timer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - startedAt) / SCAN_MS);
    if (progress >= 1) {
      clearInterval(timer);
      finish();
      return;
    }
    set({
      ...state,
      found: Math.round(total * progress),
      parsed: Math.round(inbox.parsed * progress),
      ignored: Math.round(inbox.ignored * progress),
    });
  }, TICK_MS);
}

/** The last message the server took, so a scan that failed carries on after it. */
let uploadedUpTo: InboxSms | undefined;

/** Reads every MoMo SMS on the phone and uploads them as `initial_scan`, counting as it goes. */
async function scanInbox() {
  // Running from the first moment, so a second call while the config loads starts nothing.
  set({ ...(uploadedUpTo ? state : IDLE), status: 'running' });
  const config = await getAppConfig();
  const senders = config.momoSenders;
  const limits = { maxMessages: config.limits.smsBatchMaxMessages, maxBytes: config.limits.smsBatchMaxBytes };
  set({ ...state, total: await countInbox(senders, 0) });

  for await (const page of readInbox(senders, 0, uploadedUpTo)) {
    for (const batch of toBatches(page, limits)) {
      const result = await uploadBatch('initial_scan', batch);
      set({
        ...state,
        found: state.found + batch.length,
        parsed: state.parsed + result.parsed,
        ignored: state.ignored + result.ignored + result.unparsed,
        // Oldest first, so the first batch with a payment in it dates the history.
        firstTransactionAt:
          state.firstTransactionAt ?? (result.parsed > 0 ? isoDate(Number(batch[0].dateMs)) : null),
      });
      uploadedUpTo = batch[batch.length - 1];
    }
  }
  set({ ...state, status: 'done', total: state.found });
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Back to before the scan; the sign-in stand-in calls it for a fresh account. */
export function resetScan() {
  clearInterval(timer);
  uploadedUpTo = undefined;
  set(IDLE);
}
