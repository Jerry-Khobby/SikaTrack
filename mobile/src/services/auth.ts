/**
 * Sign-in (docs/ui-spec.md §4). With EXPO_PUBLIC_API_URL set it calls
 * `/v1/auth/*`; the backend's development setup prints each code in its log.
 * Without it, a stand-in lets everyone through: every number gets a code and
 * every code works, except 000000, which is rejected so the wrong-code state can
 * be tried.
 */
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { ApiError, api, usesDevServer } from '@/api/client';
import { clearSession, getDeviceId, getRefreshToken, saveSession } from '@/api/session';
import type { ApiMe } from '@/api/types';

import { startSession } from './me';
import { resetScan } from './sms';
import { resetWallets } from './wallets';

/** Digits in a sign-in code. */
export const OTP_LENGTH = 6;

export type OtpRequest = {
  otpRequestId: string;
  /** Seconds until the code stops working. */
  expiresIn: number;
  /** Seconds before another code can be asked for. */
  resendAfter: number;
};

export type OtpVerification = {
  isNewUser: boolean;
  onboardingFinished: boolean;
};

/** `otp_invalid`: the code is wrong or has expired. */
export class OtpInvalidError extends Error {
  constructor() {
    super('otp_invalid');
  }
}

/** `rate_limited`: too many codes for this number. */
export class RateLimitedError extends Error {
  retryAfterMinutes: number;

  constructor(retryAfterMinutes: number) {
    super('rate_limited');
    this.retryAfterMinutes = retryAfterMinutes;
  }
}

/** `validation_error` on the number: the server doesn't take it as a mobile number. */
export class InvalidPhoneError extends Error {
  constructor() {
    super('validation_error');
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Which number each stand-in code was sent to, so signing in knows whose account it is. */
const requestedNumbers = new Map<string, string>();

/** `POST /v1/auth/otp/request` */
export async function requestOtp(phoneNumber: string): Promise<OtpRequest> {
  if (usesDevServer) {
    await wait(600);
    const otpRequestId = `dev-${phoneNumber}-${Date.now()}`;
    requestedNumbers.set(otpRequestId, phoneNumber);
    return { otpRequestId, expiresIn: 300, resendAfter: 60 };
  }
  try {
    const response = await api.post<{ otp_request_id: string; expires_in: number; resend_after: number }>(
      '/v1/auth/otp/request',
      { phone_number: phoneNumber },
    );
    return { otpRequestId: response.otp_request_id, expiresIn: response.expires_in, resendAfter: response.resend_after };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'rate_limited') {
      throw new RateLimitedError(Math.max(1, Math.ceil((error.retryAfter ?? 60) / 60)));
    }
    if (error instanceof ApiError && error.code === 'validation_error') throw new InvalidPhoneError();
    throw error;
  }
}

/** Whether the server has every onboarding step done, so sign-in can go straight Home. */
function onboardingDone(me: ApiMe) {
  return me.onboarding.sms_permission !== 'unknown' && me.onboarding.wallets_added && me.onboarding.first_sync_done;
}

/**
 * `POST /v1/auth/otp/verify`: signs in (making the account the first time) and
 * keeps the tokens in the secure store.
 */
export async function verifyOtp(otpRequestId: string, code: string): Promise<OtpVerification> {
  if (usesDevServer) {
    await wait(800);
    if (code === '000000') throw new OtpInvalidError();
    // The stand-in starts a brand-new account every time.
    startSession(requestedNumbers.get(otpRequestId) ?? null);
    resetWallets();
    resetScan();
    return { isNewUser: true, onboardingFinished: false };
  }
  try {
    const response = await api.post<{
      access_token: string;
      refresh_token: string;
      is_new_user: boolean;
      user: ApiMe;
    }>('/v1/auth/otp/verify', {
      otp_request_id: otpRequestId,
      code,
      device: {
        device_id: await getDeviceId(),
        platform: 'android',
        app_version: Constants.expoConfig?.version ?? '1.0.0',
        model: Device.modelName ?? undefined,
      },
    });
    await saveSession({ accessToken: response.access_token, refreshToken: response.refresh_token });
    return { isNewUser: response.is_new_user, onboardingFinished: onboardingDone(response.user) };
  } catch (error) {
    if (error instanceof ApiError && error.code === 'otp_invalid') throw new OtpInvalidError();
    throw error;
  }
}

/**
 * `POST /v1/auth/logout`: ends this phone's session and stops its push
 * notifications. The tokens go even if the call fails, so the phone is signed out.
 */
export async function signOut() {
  try {
    await api.post<void>('/v1/auth/logout', { refresh_token: getRefreshToken() ?? '' });
  } finally {
    await clearSession();
  }
}
