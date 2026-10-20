import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { TextLink, ThemedText } from '@/components/atoms';
import { CodeEntry } from '@/components/organisms';
import { AuthStepTemplate } from '@/components/templates';
import { useCountdown } from '@/hooks/use-countdown';
import { useGoBack } from '@/hooks/use-go-back';
import { OTP_LENGTH, OtpInvalidError, requestOtp, verifyOtp } from '@/services/auth';
import { getMe } from '@/services/me';
import { onboardingRoute } from '@/services/onboarding';
import { formatPhoneNumber } from '@/utils/phone';

const MAX_ATTEMPTS = 5;

type CodeParams = {
  phoneNumber: string;
  otpRequestId: string;
  expiresIn: string;
  resendAfter: string;
};

/** S05 · Enter the code */
export default function CodeScreen() {
  const router = useRouter();
  const goBack = useGoBack('/sign-in/phone');
  const params = useLocalSearchParams<CodeParams>();
  const [otpRequestId, setOtpRequestId] = useState(params.otpRequestId);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const [attempts, setAttempts] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const resend = useCountdown(Number(params.resendAfter) || 60);
  const expiresInMinutes = Math.round((Number(params.expiresIn) || 300) / 60);
  const locked = attempts >= MAX_ATTEMPTS;

  const verify = async (fullCode: string) => {
    setChecking(true);
    try {
      const { isNewUser } = await verifyOtp(otpRequestId, fullCode);
      const destination = onboardingRoute(await getMe(), isNewUser) ?? '/home';
      if (router.canDismiss()) {
        router.dismissAll();
      }
      router.replace(destination);
    } catch (e) {
      const nextAttempts = attempts + 1;
      setAttempts(nextAttempts);
      setCode('');
      setShakeKey((key) => key + 1);
      setError(
        !(e instanceof OtpInvalidError)
          ? "We couldn't check the code. Try again."
          : nextAttempts >= MAX_ATTEMPTS
            ? 'Request a new code.'
            : 'That code is wrong or has expired.',
      );
    } finally {
      setChecking(false);
    }
  };

  const handleChange = (next: string) => {
    setCode(next);
    setError(undefined);
    if (next.length === OTP_LENGTH) {
      verify(next);
    }
  };

  const resendCode = async () => {
    const request = await requestOtp(params.phoneNumber);
    setOtpRequestId(request.otpRequestId);
    setAttempts(0);
    setCode('');
    setError(undefined);
    resend.restart(request.resendAfter);
  };

  return (
    <AuthStepTemplate
      title="Enter the code"
      subtitle={
        <>
          Sent to {params.phoneNumber ? formatPhoneNumber(params.phoneNumber) : 'your phone'} ·{' '}
          <TextLink bold onPress={goBack}>
            Change
          </TextLink>
        </>
      }
      onBack={goBack}
      footer={
        <ThemedText type="fine" themeColor="textSecondary" className="text-center">
          The code submits on its own after the last digit.
        </ThemedText>
      }>
      <CodeEntry
        code={code}
        length={OTP_LENGTH}
        onChangeCode={handleChange}
        checking={checking}
        error={error}
        locked={locked}
        shakeKey={shakeKey}
        secondsUntilResend={resend.secondsLeft}
        onResend={resendCode}
        expiresInMinutes={expiresInMinutes}
      />
    </AuthStepTemplate>
  );
}

