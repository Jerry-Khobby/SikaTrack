import { useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';

export type SwipeToDeleteProps = {
  children: ReactNode;
  onDelete: () => void;
  /** What the action does, for the button and screen readers, e.g. "Delete Food budget". */
  deleteLabel: string;
};

const ACTION_WIDTH = 96;

/**
 * Swipe the row left to show a Delete button. Taps still reach the row, and
 * screen readers get the same action from the accessibility actions menu.
 */
export function SwipeToDelete({ children, onDelete, deleteLabel }: SwipeToDeleteProps) {
  const offset = useRef(new Animated.Value(0)).current;
  const open = useRef(false);

  const responder = useMemo(() => {
    const settle = (to: number) => {
      open.current = to !== 0;
      Animated.spring(offset, { toValue: to, useNativeDriver: true, bounciness: 0 }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const start = open.current ? -ACTION_WIDTH : 0;
        offset.setValue(Math.min(0, Math.max(-ACTION_WIDTH * 1.3, start + g.dx)));
      },
      onPanResponderRelease: (_, g) => {
        const position = (open.current ? -ACTION_WIDTH : 0) + g.dx;
        settle(position < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
      },
      onPanResponderTerminate: () => settle(0),
    });
  }, [offset]);

  return (
    <View
      className="overflow-hidden rounded-[20px]"
      accessibilityActions={[{ name: 'delete', label: deleteLabel }]}
      onAccessibilityAction={(event) => event.nativeEvent.actionName === 'delete' && onDelete()}>
      {/* Shows only once the row moves, so its red can't peek round the card's rounded corners. */}
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        className="absolute inset-y-0 right-0 w-24 items-stretch bg-status-bad"
        style={{ opacity: offset.interpolate({ inputRange: [-24, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }}>
        <Pressable onPress={onDelete} accessibilityLabel={deleteLabel} className="flex-1 items-center justify-center">
          <Text className="font-sans-bold text-[14px] text-white">Delete</Text>
        </Pressable>
      </Animated.View>
      {/* Follows the finger, so it keeps an animated inline style. */}
      <Animated.View style={{ transform: [{ translateX: offset }] }} {...responder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}
