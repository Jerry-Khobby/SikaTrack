import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type CountBadgeProps = {
  count: number;
};

/** A red count over an icon, e.g. unread notifications. Hidden at zero. */
export function CountBadge({ count }: CountBadgeProps) {
  const theme = useTheme();
  if (count <= 0) return null;

  return (
    <View style={[styles.badge, { backgroundColor: theme.statusBad, borderColor: theme.surface }]}>
      <Text style={styles.label}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: '#FFFFFF',
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    lineHeight: 12,
  },
});
