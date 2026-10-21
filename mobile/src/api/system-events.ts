/**
 * API errors that change the whole app rather than one screen (docs/ui-spec.md
 * §11): the session ending (G2), being asked to slow down (G4), the servers
 * being away (G5) and the app being too old (G6). The client reports them here
 * and the root layout shows the matching dialog, toast or screen.
 */
import { ApiError } from './errors';

export type SystemEvent =
  | { type: 'session_expired' }
  | { type: 'rate_limited'; retryAfter: number }
  | { type: 'unavailable' }
  | { type: 'update_required' };

type Listener = (event: SystemEvent) => void;

const listeners = new Set<Listener>();

export function onSystemEvent(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function reportSystemEvent(event: SystemEvent) {
  listeners.forEach((listener) => listener(event));
}

/** Seconds to wait when a 429 comes without a `Retry-After` header. */
const DEFAULT_RETRY_AFTER = 30;

/** Reports the errors that every screen reacts to the same way. Others stay with their screen. */
export function reportApiError(error: unknown) {
  if (!(error instanceof ApiError)) return;
  if (error.code === 'refresh_invalid') reportSystemEvent({ type: 'session_expired' });
  if (error.code === 'rate_limited') reportSystemEvent({ type: 'rate_limited', retryAfter: error.retryAfter ?? DEFAULT_RETRY_AFTER });
  if (error.code === 'app_update_required') reportSystemEvent({ type: 'update_required' });
}

/** The servers can't answer (503) or there's no answer at all while the phone is online. */
export function isUnavailable(error: unknown, online: boolean) {
  return error instanceof ApiError && (error.code === 'dependency_unavailable' || (error.status === 0 && online));
}
