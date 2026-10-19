import { Stack } from 'expo-router';

/** S06–S11. Each step saves as it goes, so going back only revisits a step. */
export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="done" options={{ animation: 'fade', gestureEnabled: false }} />
    </Stack>
  );
}
