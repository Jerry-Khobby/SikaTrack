import { View } from 'react-native';

import { ToggleRow } from '@/components/molecules';

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
  return (
    <View className="rounded-lg bg-surface px-4 py-1">
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
