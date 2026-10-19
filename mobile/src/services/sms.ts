/**
 * Stand-in for the first sync (docs/ui-spec.md S09): read the MoMo SMS on the
 * phone and upload them in batches. Reading SMS needs a development build, so
 * this plays a scan of the dataset the pipeline was built on (see
 * data-engineering/README.md). Start with EXPO_PUBLIC_EMPTY_INBOX=true to see a
 * phone with no MoMo SMS.
 */
import { updateMe } from './me';

export type ScanState = {
  status: 'idle' | 'running' | 'done';
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

/** Starts the scan once; later calls do nothing. It keeps going after its screen closes. */
export function startInitialScan() {
  if (state.status !== 'idle') return;

  const inbox =
    process.env.EXPO_PUBLIC_EMPTY_INBOX === 'true'
      ? { parsed: 0, ignored: 0, firstTransactionAt: null }
      : DEV_INBOX;
  const total = inbox.parsed + inbox.ignored;

  const finish = () => {
    set({ ...state, status: 'done', found: total, parsed: inbox.parsed, ignored: inbox.ignored });
    updateMe({ onboarding: { firstSyncDone: true } });
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

/** Back to before the scan; the sign-in stand-in calls it for a fresh account. */
export function resetScan() {
  clearInterval(timer);
  set(IDLE);
}
