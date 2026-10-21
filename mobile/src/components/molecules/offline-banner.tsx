import { Text, View } from 'react-native';

import { Icon } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

/** G1: a slim grey line under the status bar while the phone has no connection. */
export function OfflineBanner() {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className="h-8 flex-row items-center justify-center gap-2 bg-tint-neutral px-4">
      <Icon name="wifi-off" color={theme.textBody} size={15} />
      <Text className="font-sans-semibold text-[12px] text-content-body">You're offline · showing saved data</Text>
    </View>
  );
}
