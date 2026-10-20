import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { BellButton, FilterChip } from '@/components/molecules';
import { FontFamily } from '@/theme';

export type HomeHeaderProps = {
  /** E.g. `Good evening, Jerry`. */
  greeting: string;
  /** The month being shown, e.g. `Oct 2026`. */
  monthLabel: string;
  onPressMonth: () => void;
  unread: number;
  onPressBell: () => void;
};

/** Greeting, month selector and notifications bell (docs/ui-spec.md S12). */
export function HomeHeader({ greeting, monthLabel, onPressMonth, unread, onPressBell }: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <ThemedText accessibilityRole="header" style={styles.greeting} numberOfLines={1}>
          {greeting}
        </ThemedText>
        <View style={styles.month}>
          <FilterChip label={monthLabel} chevron size="small" onPress={onPressMonth} />
        </View>
      </View>
      <BellButton unread={unread} onPress={onPressBell} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 18,
    paddingBottom: 10,
    paddingLeft: 20,
    paddingRight: 16,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  month: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
});
