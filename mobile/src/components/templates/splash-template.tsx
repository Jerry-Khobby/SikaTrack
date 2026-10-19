import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { BrandColors } from '@/theme';

type SplashTemplateProps = {
  children: ReactNode;
  footer?: string;
};

/** Full-screen brand ink with the content centred and a small line at the bottom. */
export function SplashTemplate({ children, footer }: SplashTemplateProps) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {children}
      {footer && (
        <ThemedText type="caption" style={styles.footer}>
          {footer}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 48,
    color: BrandColors.onInkMuted,
  },
});
