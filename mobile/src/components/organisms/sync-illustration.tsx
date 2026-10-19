import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { DataColors } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

const CYCLE_MS = 2400;
const BAR_HEIGHTS = [40, 70, 54, 86, 34];

/** Message bubbles floating up into a growing bar chart. Decorative. */
export function SyncIllustration() {
  const theme = useTheme();
  const clock = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.timing(clock, {
        toValue: 1,
        duration: CYCLE_MS,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [clock, reduceMotion]);

  /** The clock shifted by `offset` of a cycle, wrapped back into 0–1. */
  const phase = (offset: number) => Animated.modulo(Animated.add(clock, offset), 1);

  const bubbles = [
    { left: 30, top: 56, width: 46, color: theme.tintGold, offset: 0, tail: 'left' },
    { left: 150, top: 40, width: 58, color: theme.tintBlue, offset: 0.33, tail: 'right' },
    { left: 94, top: 24, width: 40, color: theme.tintOrange, offset: 0.66, tail: 'left' },
  ] as const;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.card, { backgroundColor: theme.surface }]}>
      {bubbles.map((bubble) => {
        const p = phase(bubble.offset);
        return (
          <Animated.View
            key={bubble.left}
            style={[
              styles.bubble,
              {
                left: bubble.left,
                top: bubble.top,
                width: bubble.width,
                backgroundColor: bubble.color,
                borderBottomLeftRadius: bubble.tail === 'left' ? 2 : 10,
                borderBottomRightRadius: bubble.tail === 'right' ? 2 : 10,
                opacity: reduceMotion ? 1 : p.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateY: reduceMotion ? 0 : p.interpolate({ inputRange: [0, 1], outputRange: [0, -34] }) },
                ],
              },
            ]}
          />
        );
      })}
      <View style={styles.bars}>
        {BAR_HEIGHTS.map((height, index) => (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height,
                backgroundColor: DataColors.categories[index % DataColors.categories.length],
                transform: [
                  {
                    scaleY: reduceMotion
                      ? 1
                      : phase(index * 0.125).interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.75, 1, 0.75],
                        }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    width: 240,
    height: 180,
    borderRadius: 24,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
    height: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  bars: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  bar: {
    width: 22,
    borderRadius: 6,
    transformOrigin: 'bottom',
  },
});
