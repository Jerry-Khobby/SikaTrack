import { View } from 'react-native';

import { BrandColors } from '@/theme';

export type LogoMarkProps = {
  size?: number;
};

/** The gold tile with three rising bars. Drawn at 88 px and scaled. */
export function LogoMark({ size = 88 }: LogoMarkProps) {
  const scale = size / 88;
  const bar = { width: 10 * scale, borderRadius: 3 * scale, backgroundColor: BrandColors.ink };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 26 * scale,
        backgroundColor: BrandColors.gold,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 7 * scale,
        paddingBottom: 22 * scale,
      }}>
      <View style={[bar, { height: 18 * scale }]} />
      <View style={[bar, { height: 30 * scale }]} />
      <View style={[bar, { height: 42 * scale }]} />
    </View>
  );
}
