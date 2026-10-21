import { Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/atoms';
import { BrandColors } from '@/theme/colors';

export type ToastProps = {
  icon: IconName;
  message: string;
};

/** A short ink message above the tab bar, e.g. G4's "Slow down a little". The parent decides when it goes. */
export function Toast({ icon, message }: ToastProps) {
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2.5 rounded-[14px] bg-brand-ink px-4 py-3">
      <Icon name={icon} color={BrandColors.gold} size={18} />
      <Text className="flex-1 font-sans-semibold text-[14px] leading-[19px] text-brand-on-ink">{message}</Text>
    </View>
  );
}
