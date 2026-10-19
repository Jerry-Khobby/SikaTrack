import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { FontFamily, Radius, Spacing } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
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
  const highlighted = Boolean(error) || focused;
  const large = size === 'large';

  return (
    <View>
      <ThemedText type="label" style={styles.label}>
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
        style={[
          large ? styles.large : styles.regular,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.error : focused ? theme.borderFocus : theme.borderInput,
            borderWidth: highlighted ? 2 : 1.5,
          },
          !editable && styles.disabled,
        ]}
      />
      {(error || hint) && (
        <ThemedText
          type="fine"
          themeColor={error ? 'error' : 'textSecondary'}
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={styles.hint}>
          {error ?? hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: Spacing.two,
  },
  large: {
    height: 60,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
  },
  regular: {
    height: 52,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  hint: {
    marginTop: 6,
  },
});
