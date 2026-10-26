import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/atoms';
import { CodeEntry } from '@/components/organisms';
import { AuthStepTemplate } from '@/components/templates';
import { queryKeys } from '@/hooks/queries';
import { useCountdown } from '@/hooks/use-countdown';
import { useGoBack } from '@/hooks/use-go-back';
import { OTP_LENGTH, OtpInvalidError, RateLimitedError } from '@/services/auth';
import { sendWalletCode, verifyWallet } from '@/services/wallets';
import { formatPhoneNumber } from '@/utils/phone';

const MAX_ATTEMPTS = 5;

type Params = { id: string; phoneNumber: string };

/**
 * Confirm a wallet's number: the code texted to it proves the user holds that SIM, so only their
 * own wallets count when telling transfers between them from spending. Opened after adding a
 * wallet on a number other than the sign-in one (the sign-in number needs no code).
 */
export default function VerifyWalletScreen() {
  const { id, phoneNumber } = useLocalSearchParams<Params>();
  const goBack = useGoBack('/wallets');
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string>();
  const [attempts, setAttempts] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [expiresInMinutes, setExpiresInMinutes] = useState(5);
  const resend = useCountdown(60);
  const locked = attempts >= MAX_ATTEMPTS;

  const sendCode = async () => {
    setError(undefined);
    try {
      const sent = await sendWalletCode(id);
      setExpiresInMinutes(Math.round(sent.expiresIn / 60));
      setAttempts(0);
      setCode('');
      resend.restart(sent.resendAfter);
    } catch (e) {
      setError(
        e instanceof RateLimitedError
          ? `Too many codes for this number. Try again in ${e.retryAfterMinutes} minute${e.retryAfterMinutes === 1 ? '' : 's'}.`
          : "We couldn't send the code. Try again in a moment.",
      );
    }
  };

  // The first code goes out as the screen opens.
  useEffect(() => {
    sendCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const verify = async (fullCode: string) => {
    setChecking(true);
    try {
      await verifyWallet(id, fullCode);
      await client.invalidateQueries({ queryKey: queryKeys.wallets });
      goBack();
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
    if (next.length === OTP_LENGTH) verify(next);
  };

  return (
    <AuthStepTemplate
      title="Confirm this wallet is yours"
      subtitle={`We texted a code to ${phoneNumber ? formatPhoneNumber(phoneNumber) : 'the wallet’s number'}. Only the phone with that SIM gets it.`}
      onBack={goBack}
      footer={
        <ThemedText type="fine" themeColor="textSecondary" className="text-center">
          Until it's confirmed, transfers to this number count as spending.
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
        onResend={sendCode}
        expiresInMinutes={expiresInMinutes}
      />
    </AuthStepTemplate>
  );
}
