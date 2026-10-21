import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, TextLink, ThemedText } from '@/components/atoms';
import { InfoNote, PhoneField } from '@/components/molecules';
import { CountryPicker } from '@/components/organisms';
import { AuthStepTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { useGoBack } from '@/hooks/use-go-back';
import { useTheme } from '@/hooks/use-theme';
import { OTP_LENGTH, RateLimitedError, requestOtp } from '@/services/auth';
import { findCountry, listCountries, type Country } from '@/utils/countries';
import { examplePhoneNumber, formatPhoneInput, parsePhoneNumber } from '@/utils/phone';
import { joinWithAnd } from '@/utils/text';

/** S04 · Phone number */
export default function PhoneScreen() {
  const router = useRouter();
  const theme = useTheme();
  const goBack = useGoBack('/welcome');
  const config = useAppConfig();
  const [chosenCode, setChosenCode] = useState<string>();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  const supportedCodes = config?.supportedCountries ?? [];
  const country = findCountry(chosenCode ?? supportedCodes[0]);
  const supported = country ? supportedCodes.includes(country.code) : false;
  const phoneNumber = country && supported ? parsePhoneNumber(input, country.code) : null;
  const supportedNames = joinWithAnd(
    supportedCodes.map((code) => findCountry(code)?.name).filter((name) => name !== undefined),
  );

  const chooseCountry = (next: Country) => {
    setChosenCode(next.code);
    setInput('');
    setError(undefined);
    setPickerOpen(false);
  };

  const handleChange = (text: string) => {
    if (country) {
      setInput(formatPhoneInput(text, input, country.code));
    }
    setError(undefined);
  };

  const sendCode = async () => {
    if (!phoneNumber) {
      setError(`Enter a mobile number from ${country?.name ?? 'your country'}.`);
      return;
    }
    setSending(true);
    try {
      const request = await requestOtp(phoneNumber);
      router.push({
        pathname: '/sign-in/code',
        params: {
          phoneNumber,
          otpRequestId: request.otpRequestId,
          expiresIn: String(request.expiresIn),
          resendAfter: String(request.resendAfter),
        },
      });
    } catch (e) {
      setError(
        e instanceof RateLimitedError
          ? `Too many codes. Try again in ${e.retryAfterMinutes} minutes.`
          : "We couldn't send a code. Try again.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthStepTemplate
      title="What's your phone number?"
      subtitle={`We'll text you a ${OTP_LENGTH}-digit code.`}
      onBack={goBack}
      footer={
        <>
          <Button
            label="Send code"
            onPress={sendCode}
            disabled={!phoneNumber}
            loading={sending}
          />
          <ThemedText type="fine" themeColor="textSecondary" className="mt-[14px] text-center">
            By continuing you agree to the{' '}
            <TextLink onPress={() => router.push('/terms')}>Terms</TextLink>{' '}
            and <TextLink onPress={() => router.push('/privacy')}>Privacy Policy</TextLink>.
          </ThemedText>
        </>
      }>
      {country ? (
        <>
          <PhoneField
            label="Phone number"
            country={country}
            onPressCountry={() => setPickerOpen(true)}
            value={input}
            onChangeText={handleChange}
            placeholder={supported ? examplePhoneNumber(country.code) : undefined}
            error={error}
            editable={supported}
            autoFocus
            onSubmitEditing={sendCode}
          />
          {!supported && (
            <View className="mt-4">
              <InfoNote
                tone="warning"
                icon="globe"
                text={`SikaTrack isn't available in ${country.name} yet. MoMo messages are written differently in every country, and so far we can only read the ones from ${supportedNames}.`}
              />
            </View>
          )}
          <CountryPicker
            visible={pickerOpen}
            countries={listCountries()}
            supportedCodes={supportedCodes}
            selectedCode={country.code}
            onSelect={chooseCountry}
            onClose={() => setPickerOpen(false)}
          />
        </>
      ) : (
        <ActivityIndicator color={theme.text} />
      )}
    </AuthStepTemplate>
  );
}

