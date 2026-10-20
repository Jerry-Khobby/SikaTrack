import { View } from 'react-native';

export type LogoMarkProps = {
  size?: number;
};

/** The gold tile with three rising bars. Drawn at 88 px and scaled. */
export function LogoMark({ size = 88 }: LogoMarkProps) {
  const scale = size / 88;
  const bar = { width: 10 * scale, borderRadius: 3 * scale };

  return (
    <View
      className="flex-row items-end justify-center bg-brand-gold"
      style={{ width: size, height: size, borderRadius: 26 * scale, gap: 7 * scale, paddingBottom: 22 * scale }}>
      <View className="bg-brand-ink" style={[bar, { height: 18 * scale }]} />
      <View className="bg-brand-ink" style={[bar, { height: 30 * scale }]} />
      <View className="bg-brand-ink" style={[bar, { height: 42 * scale }]} />
    </View>
  );
}
