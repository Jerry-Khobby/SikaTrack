/**
 * The signed-in session: the access and refresh tokens, kept in the phone's
 * secure store (Android Keystore) so a restart stays signed in, and this phone's
 * device id, made once and kept. The client reads the access token from here.
 */
import * as SecureStore from 'expo-secure-store';

import { uuid } from '@/utils/uuid';

const KEYS = {
  access: 'sikatrack.access_token',
  refresh: 'sikatrack.refresh_token',
  device: 'sikatrack.device_id',
} as const;

let accessToken: string | null = null;
let refreshToken: string | null = null;

export type Tokens = { accessToken: string; refreshToken: string };

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  return refreshToken;
}

export function isSignedIn() {
  return refreshToken !== null;
}

/** Keeps new tokens, after sign-in or a refresh (the old refresh token no longer works). */
export async function saveSession(tokens: Tokens) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.access, tokens.accessToken),
    SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken),
  ]);
}

/** Reads a saved session at launch. True when there's one to try. */
export async function loadSession() {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(KEYS.access),
    SecureStore.getItemAsync(KEYS.refresh),
  ]);
  accessToken = access;
  refreshToken = refresh;
  return refresh !== null;
}

/** Forgets the tokens: sign-out, account deletion, or a session the server ended. */
export async function clearSession() {
  accessToken = null;
  refreshToken = null;
  await Promise.all([SecureStore.deleteItemAsync(KEYS.access), SecureStore.deleteItemAsync(KEYS.refresh)]);
}

/** This phone's id for `/v1/auth/otp/verify` and `/v1/devices/{id}`: made once, then kept. */
export async function getDeviceId() {
  const saved = await SecureStore.getItemAsync(KEYS.device);
  if (saved) return saved;
  const id = uuid();
  await SecureStore.setItemAsync(KEYS.device, id);
  return id;
}
