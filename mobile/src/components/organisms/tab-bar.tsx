import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/atoms';
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

/**
 * The five main tabs along the bottom. The current tab's icon and label turn
 * blue, and a short bar on the top edge slides over to it.
 */
export function TabBar({ items, onPress }: TabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const position = useRef(new Animated.Value(0)).current;
  const focusedIndex = Math.max(0, items.findIndex((item) => item.focused));
  const tabWidth = items.length ? width / items.length : 0;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    const to = focusedIndex * tabWidth;
    if (reduceMotion) {
      position.setValue(to);
    } else {
      Animated.spring(position, { toValue: to, useNativeDriver: true, speed: 18, bounciness: 4 }).start();
    }
  }, [focusedIndex, tabWidth, reduceMotion, position]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className="flex-row border-t border-line bg-surface"
      style={{ paddingBottom: insets.bottom }}>
      {tabWidth > 0 && (
        // Moves with the current tab, so it keeps an animated inline style.
        <Animated.View
          pointerEvents="none"
          style={{ position: 'absolute', top: -1, left: 0, width: tabWidth, transform: [{ translateX: position }] }}>
          <View className="h-[3px] w-8 self-center rounded-b-full bg-link" />
        </Animated.View>
      )}
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.focused }}
          onPress={() => onPress(item.key)}
          className="h-[68px] flex-1 items-center justify-center gap-1 active:opacity-60">
          <Icon name={item.icon} color={item.focused ? theme.link : theme.textSecondary} size={22} strokeWidth={item.focused ? 2.2 : 1.8} />
          <Text
            className={`text-[11px] ${item.focused ? 'font-sans-extrabold text-link' : 'font-sans-semibold text-content-secondary'}`}
            numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
