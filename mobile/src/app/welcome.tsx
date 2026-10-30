import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { Logo, type FeatureRowProps } from '@/components/molecules';
import { FeatureList } from '@/components/organisms';
import { ScreenTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { GoogleSignInUnavailableError, signInWithGoogle } from '@/services/auth';
import { getMe } from '@/services/me';
import { onboardingRoute } from '@/services/onboarding';
import { joinWithAnd } from '@/utils/text';

const FEATURES: FeatureRowProps[] = [
  {
    icon: 'pie-chart',
    tone: 'blue',
    text: 'See where your money goes: automatically, from your MoMo SMS.',
  },
  { icon: 'repeat', tone: 'orange', text: 'Spot fees and payments that keep charging.' },
  { icon: 'target', tone: 'green', text: 'Set budgets and get a heads-up before you overspend.' },
];

/** S03 · Welcome */
export default function WelcomeScreen() {
  const router = useRouter();
  const config = useAppConfig();
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string>();
  const methods = config?.signInMethods ?? [];
  const google = methods.includes('google');
  const phone = methods.includes('phone');

  const continueWithGoogle = async () => {
    setSigningIn(true);
    setError(undefined);
    try {
      const result = await signInWithGoogle();
      if (!result) return; // closed Google's account picker
      router.replace(onboardingRoute(await getMe(), result.isNewUser) ?? '/home');
    } catch (e) {
      setError(
        e instanceof GoogleSignInUnavailableError
          ? "Google sign-in isn't available on this phone."
          : "We couldn't sign you in with Google. Try again.",
      );
    } finally {
      setSigningIn(false);
    }
  };

  const providerNames = joinWithAnd(
    config?.providers.filter((provider) => provider.supported).map((provider) => provider.name) ??
      [],
  );

  return (
    <ScreenTemplate
      footer={
        <>
          {providerNames && (
            <ThemedText type="caption" themeColor="textSecondary" className="mb-4 text-center">
              Works with {providerNames}.
            </ThemedText>
          )}
          {error && (
            <ThemedText type="caption" themeColor="error" className="mb-3 text-center" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          )}
          {google && <Button label="Continue with Google" onPress={continueWithGoogle} loading={signingIn} />}
          {phone && (
            <Button
              variant={google ? 'link' : 'primary'}
              label={google ? 'Use your phone number instead' : 'Get started'}
              onPress={() => router.push('/sign-in/phone')}
            />
          )}
          <View className="mt-2">
            <Button
              variant="link"
              label="How we handle your data"
              onPress={() => router.push('/privacy')}
            />
          </View>
        </>
      }>
      <Logo />
      <ThemedText type="display" accessibilityRole="header" className="mb-10 mt-14">
        Your MoMo,{'\n'}made clear.
      </ThemedText>
      <FeatureList items={FEATURES} />
    </ScreenTemplate>
  );
}

