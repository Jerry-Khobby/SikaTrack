import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type TabBarItem = {
  key: string;
  label: string;
  icon: IconName;
  focused: boolean;
};

export type TabBarProps = {
  items: TabBarItem[];
  onPress: (key: string) => void;
};

/** The five main tabs along the bottom, the current one in a soft pill. */
export function TabBar({ items, onPress }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom },
      ]}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.focused }}
          onPress={() => onPress(item.key)}
          style={styles.tab}>
          <View style={[styles.pill, item.focused && { backgroundColor: theme.tabActive }]}>
            <Icon name={item.icon} color={item.focused ? theme.text : theme.textSecondary} size={22} />
          </View>
          <Text
            style={[
              styles.label,
              {
                color: item.focused ? theme.text : theme.textSecondary,
                fontFamily: item.focused ? FontFamily.extraBold : FontFamily.semiBold,
              },
            ]}
            numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tab: {
    flex: 1,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
  },
});
