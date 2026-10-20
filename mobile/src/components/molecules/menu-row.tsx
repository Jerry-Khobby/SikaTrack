import { Pressable, Text, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type MenuRowProps = {
  icon: IconName;
  label: string;
  /** A short value on the right, e.g. `GHS 5.00`. */
  detail?: string;
  /** Leave out for a row that isn't ready; it shows "Coming soon" instead. */
  onPress?: () => void;
  /** Red, for things like deleting the account. */
  danger?: boolean;
  divider?: boolean;
};

/** One line in a grouped settings menu. */
export function MenuRow({ icon, label, detail, onPress, danger, divider }: MenuRowProps) {
  const theme = useTheme();
  const comingSoon = !onPress;
  const color = comingSoon ? theme.textDisabled : danger ? theme.iconRed : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={comingSoon ? `${label}, coming soon` : detail ? `${label}, ${detail}` : label}
      accessibilityState={{ disabled: comingSoon }}
      disabled={comingSoon}
      onPress={onPress}
      className={`h-14 flex-row items-center gap-[14px] px-4 active:bg-unread-row ${divider ? 'border-b border-divider' : ''}`}>
      <Icon name={icon} color={color} size={21} />
      <Text
        className={`flex-1 font-sans-semibold text-[15px] ${
          comingSoon ? 'text-content-disabled' : danger ? 'text-icon-red' : 'text-content'
        }`}>
        {label}
      </Text>
      {comingSoon ? (
        <ThemedText type="none" themeColor="textDisabled" className="font-sans-bold text-[12px]">
          Coming soon
        </ThemedText>
      ) : (
        <View className="flex-row items-center gap-2">
          {detail && (
            <ThemedText type="caption" themeColor="textSecondary">
              {detail}
            </ThemedText>
          )}
          {!danger && <Icon name="chevron-right" color={theme.textDisabled} size={16} />}
        </View>
      )}
    </Pressable>
  );
}
