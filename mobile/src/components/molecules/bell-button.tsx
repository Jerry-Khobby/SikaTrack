import { Pressable } from 'react-native';

import { CountBadge, Icon } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type BellButtonProps = {
  unread: number;
  onPress: () => void;
};

/** The notifications bell with its unread count. */
export function BellButton({ unread, onPress }: BellButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onPress={onPress}
      className="h-12 w-12 items-center justify-center rounded-3xl bg-surface active:opacity-70">
      <Icon name="bell" color={theme.text} size={22} />
      <CountBadge count={unread} />
    </Pressable>
  );
}
