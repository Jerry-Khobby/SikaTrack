/**
 * Stand-ins for the sign-in calls in docs/ui-spec.md §4 until the backend is
 * wired in. Every number gets a code and every code is accepted, except
 * 000000, which is rejected so the wrong-code state can be tried.
 */
import { api, setAccessToken } from '@/api/client';

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Which number each code was sent to, so signing in knows whose account it is. */
const requestedNumbers = new Map<string, string>();

/** `POST /v1/auth/otp/request` */
export async function requestOtp(phoneNumber: string): Promise<OtpRequest> {
  await wait(600);
  const otpRequestId = `dev-${phoneNumber}-${Date.now()}`;
  requestedNumbers.set(otpRequestId, phoneNumber);
  return { otpRequestId, expiresIn: 300, resendAfter: 60 };
}

/** `POST /v1/auth/otp/verify`. Every sign-in starts a brand-new account. */
export async function verifyOtp(otpRequestId: string, code: string): Promise<OtpVerification> {
  await wait(800);
  if (code === '000000') {
    throw new OtpInvalidError();
  }
  startSession(requestedNumbers.get(otpRequestId) ?? null);
  resetWallets();
  resetScan();
  return { isNewUser: true, onboardingFinished: false };
}

/**
 * `POST /v1/auth/logout`: ends this phone's session and stops its push
 * notifications. The tokens go even if the call fails, so the phone is signed out.
 */
export async function signOut() {
  try {
    await api.post<void>('/v1/auth/logout', {});
  } finally {
    setAccessToken(null);
  }
}
