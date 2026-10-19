import { OtpInvalidError, requestOtp, verifyOtp } from './auth';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

async function settle<T>(promise: Promise<T>) {
  await jest.runAllTimersAsync();
  return promise;
}

describe('requestOtp', () => {
  it('returns a request with its expiry and resend wait', async () => {
    const request = await settle(requestOtp('+233241234567'));
    expect(request.otpRequestId).toEqual(expect.any(String));
    expect(request.expiresIn).toBe(300);
    expect(request.resendAfter).toBe(60);
  });
});

describe('verifyOtp', () => {
  it('accepts any code while the backend is not wired in', async () => {
    await expect(settle(verifyOtp('req', '123456'))).resolves.toEqual({
      isNewUser: true,
      onboardingFinished: false,
    });
  });

  it('rejects 000000 so the wrong-code state can be seen', async () => {
    const result = verifyOtp('req', '000000');
    const assertion = expect(result).rejects.toBeInstanceOf(OtpInvalidError);
    await jest.runAllTimersAsync();
    await assertion;
  });
});
