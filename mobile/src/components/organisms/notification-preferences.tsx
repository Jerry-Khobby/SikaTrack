import { StyleSheet, View } from 'react-native';

import { ToggleRow } from '@/components/molecules';
import { Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type NotificationOption<Key extends string> = {
  key: Key;
  title: string;
  description: string;
};

export type NotificationPreferencesProps<Key extends string> = {
  options: NotificationOption<Key>[];
  values: Record<Key, boolean>;
  onChange: (key: Key, value: boolean) => void;
};

/** A card of on/off switches, one per kind of notification. */
export function NotificationPreferences<Key extends string>({
  options,
  values,
  onChange,
}: NotificationPreferencesProps<Key>) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {options.map((option, index) => (
        <ToggleRow
          key={option.key}
          title={option.title}
          description={option.description}
          value={values[option.key]}
          onValueChange={(value) => onChange(option.key, value)}
          divider={index < options.length - 1}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: 18,
  },
});
