import { Text, View } from 'react-native';

import { LogoMark, ThemedText } from '@/components/atoms';

export type LogoProps = {
  /** `splash`: large and stacked, on the brand ink. `inline`: small, beside the wordmark. */
  variant?: 'splash' | 'inline';
};

export function Logo({ variant = 'inline' }: LogoProps) {
  if (variant === 'splash') {
    return (
      <View accessibilityRole="image" accessibilityLabel="SikaTrack" className="items-center gap-5">
        <LogoMark size={88} />
        <Text className="font-sans-extrabold text-[34px] leading-[42px] tracking-[-0.5px] text-brand-on-ink">
          Sika<Text className="text-brand-gold">Track</Text>
        </Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="image" accessibilityLabel="SikaTrack" className="flex-row items-center gap-2.5">
      <LogoMark size={40} />
      <ThemedText type="none" className="font-sans-extrabold text-[20px] leading-[26px]">
        SikaTrack
      </ThemedText>
    </View>
  );
}
