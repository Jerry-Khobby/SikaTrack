import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'className' | 'accessibilityLabel'> & {
  label: string;
  /** Shown faintly after the label, e.g. "(optional)". */
  labelNote?: string;
  hint?: string;
  error?: string;
  /** `large` for a screen's one field, `regular` inside forms. */
  size?: 'large' | 'regular';
};

/** A labelled text input with an optional hint or error under it. */
export function TextField({
  label,
  labelNote,
  hint,
  error,
  size = 'regular',
  editable = true,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const border = error
    ? 'border-2 border-error'
    : focused
      ? 'border-2 border-line-focus'
      : 'border-[1.5px] border-line-input';
  const shape =
    size === 'large'
      ? 'h-input rounded-md px-4 text-[18px]'
      : 'h-[52px] rounded-sm px-[14px] text-[16px]';

  return (
    <View>
      <ThemedText type="label" className="mb-2">
        {label}
        {labelNote && (
          <ThemedText type="caption" themeColor="textSecondary">
            {' '}
            {labelNote}
          </ThemedText>
        )}
      </ThemedText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        selectionColor={theme.link}
        editable={editable}
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        className={`bg-surface font-sans-semibold text-content ${shape} ${border} ${editable ? '' : 'opacity-60'}`}
      />
      {(error || hint) && (
        <ThemedText
          type="fine"
          themeColor={error ? 'error' : 'textSecondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          className="mt-1.5">
          {error ?? hint}
        </ThemedText>
      )}
    </View>
  );
}
