import { Text, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type LimitInputProps = {
  label: string;
  currency: string;
  value: string;
  onChangeText: (text: string) => void;
  /** A line under the field, e.g. what the user usually spends. */
  hint?: React.ReactNode;
  error?: string;
};

/** A big money field for one amount, e.g. a budget's monthly limit. */
export function LimitInput({ label, currency, value, onChangeText, hint, error }: LimitInputProps) {
  const theme = useTheme();

  return (
    <View>
      <ThemedText type="none" className="mb-2 font-sans-extrabold text-[13px] leading-[18px]">
        {label}
      </ThemedText>
      <View
        className={`h-[68px] flex-row items-center gap-2 rounded-2xl border-2 bg-surface px-4 ${
          error ? 'border-error' : 'border-line-focus'
        }`}>
        <Text className="font-sans-bold text-[18px] text-content-secondary">{currency}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/[^\d.]/g, ''))}
          keyboardType="decimal-pad"
          selectionColor={theme.link}
          placeholder="0.00"
          placeholderTextColor={theme.textDisabled}
          className="h-full min-w-0 flex-1 font-sans-extrabold text-[30px] text-content"
          style={{ fontVariant: ['tabular-nums'] }}
        />
      </View>
      {error ? (
        <ThemedText type="caption" themeColor="error" accessibilityLiveRegion="polite" className="mt-2">
          {error}
        </ThemedText>
      ) : (
        hint && (
          <ThemedText type="caption" themeColor="textSecondary" className="mt-2">
            {hint}
          </ThemedText>
        )
      )}
    </View>
  );
}
