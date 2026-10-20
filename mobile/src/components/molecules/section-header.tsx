import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ControlHeight, FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** A card's title with an optional "See all" on the right. */
export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <ThemedText type="subheading" accessibilityRole="header" style={styles.title}>
        {title}
      </ThemedText>
      {actionLabel && onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          onPress={onAction}
          style={styles.action}>
          <Text style={[styles.actionLabel, { color: theme.link }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: ControlHeight.touch,
  },
  title: {
    fontFamily: FontFamily.extraBold,
  },
  action: {
    height: ControlHeight.touch,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  actionLabel: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
  },
});
