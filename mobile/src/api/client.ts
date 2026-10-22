/**
 * The one place the app talks HTTP. Set EXPO_PUBLIC_API_URL (e.g.
 * `https://api.sikatrack.app`) and every service calls the real backend;
 * leave it unset and requests go to the in-app dev server, which answers with
 * the same JSON. Nothing above this file changes between the two.
 */
import { handleDevRequest } from './dev-server';
import { ApiError } from './errors';
import { clearSession, getAccessToken, getRefreshToken, saveSession } from './session';
import { reportApiError } from './system-events';
import type { ApiProblem } from './types';

export { ApiError };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Query values; arrays repeat the key (`category=food&category=bills`). */
export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

export type RequestOptions = {
  query?: Query;
  body?: unknown;
  /** Extra headers, e.g. `Idempotency-Key` on an SMS upload. */
  headers?: Record<string, string>;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

/** True while requests go to the in-app dev server (no EXPO_PUBLIC_API_URL). */
export const usesDevServer = !BASE_URL;

/** How long a request may take before it counts as no answer (G5 then shows, if nothing is saved). */
const TIMEOUT_MS = 20_000;

export function toQueryString(query: Query = {}) {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    const values = Array.isArray(value) ? value : [value];
    for (const item of values) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Sends a request; errors that affect the whole app (sign-in gone, slow down, too old) are reported first. */
export async function request<T>(method: HttpMethod, path: string, options: RequestOptions = {}): Promise<T> {
  try {
    if (!BASE_URL) return await handleDevRequest<T>(method, path, options.query ?? {}, options.body);
    return await withFreshToken(() => send<T>(method, path, options));
  } catch (error) {
    reportApiError(error);
    throw error;
  }
}

/**
 * G3: an access token lasts minutes. When the server says `unauthenticated`,
 * swap the refresh token for new ones and try the request once more.
 */
async function withFreshToken<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'unauthenticated' || !getRefreshToken()) throw error;
    await refreshTokens();
    return call();
  }
}

let refreshing: Promise<void> | null = null;

/**
 * `POST /v1/auth/refresh`. One at a time: requests that fail together share it,
 * since each refresh token works once. If the server refuses it
 * (`refresh_invalid`), the session is over and the tokens go.
 */
function refreshTokens() {
  refreshing ??= (async () => {
    try {
      const tokens = await send<{ access_token: string; refresh_token: string }>('POST', '/v1/auth/refresh', {
        body: { refresh_token: getRefreshToken() },
      });
      await saveSession({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await clearSession();
      throw error;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function send<T>(method: HttpMethod, path: string, options: RequestOptions): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const token = getAccessToken();
  try {
    response = await fetch(`${BASE_URL}${path}${toQueryString(options.query)}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // No connection, or no answer in time: either way there's nothing to show from the server.
    throw new ApiError({ status: 0, code: 'network_unavailable', title: "Can't reach SikaTrack" });
  } finally {
    clearTimeout(timer);
  }

  const requestId = response.headers.get('X-Request-ID') ?? undefined;
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as ApiProblem | null;
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
    throw new ApiError(problem ?? { status: response.status, code: 'unexpected_error' }, requestId, retryAfter);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>('POST', path, { body, headers }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
