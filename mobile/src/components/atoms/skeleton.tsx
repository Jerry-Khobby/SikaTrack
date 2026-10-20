import { useEffect, useRef } from 'react';
import { Animated, type DimensionValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type SkeletonProps = {
  width?: DimensionValue;
  height: number;
  radius?: number;
  /** Override the block colour, e.g. on the brand-ink hero card. */
  color?: string;
};

/** A pulsing grey block in the shape of content that's still loading. */
export function Skeleton({ width = '100%', height, radius = 8, color }: SkeletonProps) {
  const theme = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{ width, height, borderRadius: radius, backgroundColor: color ?? theme.skeleton, opacity }}
    />
  );
}
