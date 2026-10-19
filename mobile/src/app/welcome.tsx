import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { Logo, type FeatureRowProps } from '@/components/molecules';
import { FeatureList } from '@/components/organisms';
import { ScreenTemplate } from '@/components/templates';
import { useAppConfig } from '@/hooks/use-app-config';
import { Spacing } from '@/theme';
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
  const providerNames = joinWithAnd(
    config?.providers.filter((provider) => provider.supported).map((provider) => provider.name) ??
      [],
  );

  return (
    <ScreenTemplate
      footer={
        <>
          {providerNames && (
            <ThemedText type="caption" themeColor="textSecondary" style={styles.providers}>
              Works with {providerNames}.
            </ThemedText>
          )}
          <Button label="Get started" onPress={() => router.push('/sign-in/phone')} />
          <View style={styles.privacy}>
            <Button
              variant="link"
              label="How we handle your data"
              onPress={() => router.push('/privacy')}
            />
          </View>
        </>
      }>
      <Logo />
      <ThemedText type="display" accessibilityRole="header" style={styles.headline}>
        Your MoMo,{'\n'}made clear.
      </ThemedText>
      <FeatureList items={FEATURES} />
    </ScreenTemplate>
  );
}

const styles = StyleSheet.create({
  headline: {
    marginTop: 56,
    marginBottom: 40,
  },
  providers: {
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  privacy: {
    marginTop: Spacing.two,
  },
});
