import { View } from 'react-native';

import { Button, ThemedText, type IconName } from '@/components/atoms';

import { IconCircle } from './icon-circle';

export type EmptyStateProps = {
  title: string;
  message: string;
  /** An icon for the illustration; without one, a sketch of an empty chart. */
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
};

const BARS = [
  { height: 22, className: 'bg-line' },
  { height: 38, className: 'bg-line' },
  { height: 30, className: 'bg-line' },
  { height: 50, className: 'bg-line-input' },
];

/** Why a screen is empty, and the action that fills it (docs/ui-spec.md §3). */
export function EmptyState({ title, message, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="items-center gap-[14px] px-6 py-8">
      {icon ? (
        <IconCircle icon={icon} tone="neutral" size={96} />
      ) : (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="h-[132px] w-[132px] flex-row items-end justify-center gap-2 rounded-[66px] bg-surface pb-9">
          {BARS.map((bar, index) => (
            <View key={index} className={`w-4 rounded-[5px] ${bar.className}`} style={{ height: bar.height }} />
          ))}
        </View>
      )}
      <ThemedText type="none" accessibilityRole="header" className="text-center font-sans-extrabold text-[18px] leading-[26px]">
        {title}
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" className="max-w-[290px] text-center">
        {message}
      </ThemedText>
      {actionLabel && onAction && (
        <View className="mt-1.5 min-w-[200px]">
          <Button variant="secondary" label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}
