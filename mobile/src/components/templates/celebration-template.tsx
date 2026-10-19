import { StatusBar } from 'expo-status-bar';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandColors, DataColors, Spacing } from '@/theme';

type CelebrationTemplateProps = {
  children: ReactNode;
  action: ReactNode;
};

/** Confetti pieces, placed in percent so they spread on any screen size. */
const CONFETTI = [
  { left: '13%', top: '17%', width: 12, height: 12, radius: 3, rotate: '20deg', color: BrandColors.gold },
  { left: '77%', top: '14%', width: 10, height: 18, radius: 3, rotate: '-25deg', color: DataColors.categories[1] },
  { left: '23%', top: '36%', width: 8, height: 8, radius: 4, rotate: '0deg', color: DataColors.categories[0] },
  { left: '82%', top: '34%', width: 14, height: 8, radius: 3, rotate: '35deg', color: DataColors.categories[2] },
  { left: '51%', top: '11%', width: 8, height: 14, radius: 3, rotate: '60deg', color: DataColors.categories[4] },
  { left: '9%', top: '50%', width: 10, height: 10, radius: 2, rotate: '12deg', color: DataColors.categories[1] },
  { left: '87%', top: '52%', width: 9, height: 9, radius: 5, rotate: '0deg', color: BrandColors.gold },
] as const;

/** A brand-ink screen with confetti, the content centred and one action at the bottom. */
export function CelebrationTemplate({ children, action }: CelebrationTemplateProps) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.confetti}>
        {CONFETTI.map((piece, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: piece.left,
              top: piece.top,
              width: piece.width,
              height: piece.height,
              borderRadius: piece.radius,
              backgroundColor: piece.color,
              transform: [{ rotate: piece.rotate }],
            }}
          />
        ))}
      </View>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.body}>{children}</View>
        {action}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.ink,
  },
  confetti: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  safeArea: {
    flex: 1,
    padding: Spacing.four,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
});
