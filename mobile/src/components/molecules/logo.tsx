import { StyleSheet, View } from 'react-native';

import { LogoMark, ThemedText } from '@/components/atoms';
import { BrandColors, FontFamily } from '@/theme';

export type LogoProps = {
  /** `splash`: large and stacked, on the brand ink. `inline`: small, beside the wordmark. */
  variant?: 'splash' | 'inline';
};

export function Logo({ variant = 'inline' }: LogoProps) {
  if (variant === 'splash') {
    return (
      <View accessibilityRole="image" accessibilityLabel="SikaTrack" style={styles.splash}>
        <LogoMark size={88} />
        <ThemedText style={styles.splashWordmark}>
          Sika<ThemedText style={[styles.splashWordmark, styles.gold]}>Track</ThemedText>
        </ThemedText>
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel="SikaTrack" style={styles.inline}>
      <LogoMark size={40} />
      <ThemedText type="heading" style={styles.inlineWordmark}>
        SikaTrack
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    alignItems: 'center',
    gap: 20,
  },
  splashWordmark: {
    fontFamily: FontFamily.extraBold,
    fontSize: 34,
    lineHeight: 42,
    letterSpacing: -0.5,
    color: BrandColors.onInk,
  },
  gold: {
    color: BrandColors.gold,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineWordmark: {
    fontFamily: FontFamily.extraBold,
  },
});
