/**
 * The one place the app talks HTTP. Set EXPO_PUBLIC_API_URL (e.g.
 * `https://api.sikatrack.app`) and every service calls the real backend;
 * leave it unset and requests go to the in-app dev server, which answers with
 * the same JSON. Nothing above this file changes between the two.
 */
import { handleDevRequest } from './dev-server';
import { ApiError } from './errors';
import type { ApiProblem } from './types';

export { ApiError };

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Query values; arrays repeat the key (`category=food&category=bills`). */
export type Query = Record<string, string | number | boolean | string[] | null | undefined>;

const BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

/** Bearer token for signed-in calls. Sign-in will set this once the auth API is wired in. */
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

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

export async function request<T>(
  method: HttpMethod,
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<T> {
  if (!BASE_URL) {
    return handleDevRequest<T>(method, path, options.query ?? {}, options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}${toQueryString(options.query)}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError({ status: 0, code: 'network_unavailable', title: "Can't reach SikaTrack" });
  }

  const requestId = response.headers.get('X-Request-ID') ?? undefined;
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as ApiProblem | null;
    const retryAfter = Number(response.headers.get('Retry-After')) || undefined;
    throw new ApiError(
      problem ?? { status: response.status, code: 'unexpected_error' },
      requestId,
      retryAfter,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
