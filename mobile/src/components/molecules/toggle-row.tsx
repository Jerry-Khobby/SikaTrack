import { StyleSheet, View } from 'react-native';

import { ThemedText, Toggle } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type ToggleRowProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  divider?: boolean;
};

/** A setting with a title, one line about it, and a switch. */
export function ToggleRow({ title, description, value, onValueChange, divider }: ToggleRowProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.row,
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
      ]}>
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.description}>
          {description}
        </ThemedText>
      </View>
      <Toggle value={value} onValueChange={onValueChange} accessibilityLabel={title} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    lineHeight: 21,
  },
  description: {
    marginTop: 3,
    lineHeight: 19,
  },
});
