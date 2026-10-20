import { Pressable, StyleSheet } from 'react-native';

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
      style={({ pressed }) => [styles.bell, { backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}>
      <Icon name="bell" color={theme.text} size={22} />
      <CountBadge count={unread} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
