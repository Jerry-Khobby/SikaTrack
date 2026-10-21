import '@/global.css';
import '@/theme/interop';

import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { watchConnectivity } from '@/api/connectivity';
import { createQueryClient } from '@/api/query-client';
import { SystemStates } from '@/components/organisms';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { FontAssets, ThemeVariables } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();
  const [queryClient] = useState(createQueryClient);
  const router = useRouter();
  const [fontsLoaded, fontError] = useFonts(FontAssets);
  const ready = fontsLoaded || fontError != null;

  // G1: queries pause offline and keep their saved data.
  useEffect(() => watchConnectivity(), []);

  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{
          ...navigationTheme,
          colors: { ...navigationTheme.colors, background: theme.background },
        }}>
        <StatusBar style="auto" />
        {/* The theme's CSS variables, so Tailwind colour classes follow light and dark mode. */}
        <View className="flex-1" style={ThemeVariables[scheme]}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" options={{ animation: 'none' }} />
            <Stack.Screen name="update-required" options={{ animation: 'fade' }} />
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="transactions/[id]" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="wallets" />
            <Stack.Screen name="recurring/index" />
            <Stack.Screen name="recurring/[id]" />
            <Stack.Screen name="categories/[id]" />
            <Stack.Screen name="counterparties/index" />
            <Stack.Screen name="counterparties/[id]" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="notification-settings" />
            <Stack.Screen name="low-balance" />
            <Stack.Screen name="sync" />
            <Stack.Screen name="delete-account" />
            <Stack.Screen name="account-deleted" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
          <SystemStates
            onUpdateRequired={() => router.replace('/update-required')}
            onCodeSent={(params) => router.replace({ pathname: '/sign-in/code', params })}
            onUseAnotherNumber={() => router.replace('/sign-in/phone')}
          />
        </View>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

