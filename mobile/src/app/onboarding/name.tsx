import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, ThemedText } from '@/components/atoms';
import { TextField } from '@/components/molecules';
import { OnboardingStepTemplate } from '@/components/templates';
import { useMe } from '@/hooks/use-me';
import { updateMe } from '@/services/me';
import { ONBOARDING_STEP_COUNT } from '@/services/onboarding';
import { Spacing } from '@/theme';

/** S06 · Your name. Optional. */
export default function NameScreen() {
  const router = useRouter();
  const me = useMe();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me?.displayName) {
      setName(me.displayName);
    }
  }, [me]);

  const next = () => router.push('/onboarding/sms');

  const save = async () => {
    setSaving(true);
    await updateMe({ displayName: name.trim() });
    setSaving(false);
    next();
  };

  return (
    <OnboardingStepTemplate
      step={1}
      totalSteps={ONBOARDING_STEP_COUNT}
      showStepLabel
      footer={
        <>
          <Button label="Continue" onPress={save} disabled={!name.trim()} loading={saving} />
          <Button variant="link" label="Skip" onPress={next} />
        </>
      }>
      <ThemedText type="title" accessibilityRole="header" style={styles.title}>
        What should we call you?
      </ThemedText>
      <ThemedText type="bodySmall" themeColor="textSecondary" style={styles.subtitle}>
        We'll use it to greet you on your dashboard.
      </ThemedText>
      <TextField
        label="Your first name"
        size="large"
        value={name}
        onChangeText={setName}
        autoFocus
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        onSubmitEditing={() => name.trim() && save()}
      />
    </OnboardingStepTemplate>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: 40,
    marginBottom: Spacing.two,
  },
  subtitle: {
    marginBottom: 28,
  },
});
