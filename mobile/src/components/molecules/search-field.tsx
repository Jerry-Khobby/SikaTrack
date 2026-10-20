import { TextInput, View } from 'react-native';

import { Icon } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type SearchFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  autoFocus?: boolean;
};

export function SearchField({ value, onChangeText, placeholder, autoFocus }: SearchFieldProps) {
  const theme = useTheme();

  return (
    <View className="h-12 flex-row items-center gap-2.5 rounded-md border-[1.5px] border-line-input bg-surface px-[14px]">
      <Icon name="search" color={theme.textSecondary} size={20} />
      <TextInput
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.link}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        className="h-full flex-1 font-sans text-[16px] text-content"
      />
    </View>
  );
}
