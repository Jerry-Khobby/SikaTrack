import { View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';
import type { SyncState } from '@/services/sync';

export type SyncStatusCardProps = {
  state: SyncState;
  title: string;
  message: string;
};

const LOOK: Record<SyncState, { icon: IconName; box: string; color: 'iconSuccess' | 'iconBlue' | 'iconAmber' }> = {
  up_to_date: { icon: 'check', box: 'bg-tint-success', color: 'iconSuccess' },
  processing: { icon: 'clock', box: 'bg-tint-blue', color: 'iconBlue' },
  delayed: { icon: 'alert', box: 'bg-tint-amber', color: 'iconAmber' },
};

/** S34's headline: up to date (green), processing (blue) or taking longer than usual (amber). */
export function SyncStatusCard({ state, title, message }: SyncStatusCardProps) {
  const theme = useTheme();
  const look = LOOK[state];

  return (
    <View accessibilityLiveRegion="polite" className={`flex-row items-start gap-[14px] rounded-[22px] p-5 ${look.box}`}>
      <View className="h-12 w-12 items-center justify-center rounded-3xl bg-surface">
        <Icon name={look.icon} color={theme[look.color]} size={24} />
      </View>
      <View className="flex-1">
        <ThemedText type="none" accessibilityRole="header" className="font-sans-extrabold text-[18px] leading-[24px]">
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textBody" className="mt-1">
          {message}
        </ThemedText>
      </View>
    </View>
  );
}
