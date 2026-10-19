import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/atoms';
import { ControlHeight, FontFamily, Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type CodeInputProps = {
  value: string;
  onChangeText: (code: string) => void;
  length: number;
  invalid?: boolean;
  editable?: boolean;
  /** Change this number to shake the boxes, e.g. after a wrong code. */
  shakeKey?: number;
};

/**
 * One box per digit. A single transparent input sits over the boxes, so typing
 * moves along by itself, a pasted code fills every box, and Android can autofill
 * the code from the SMS.
 */
export function CodeInput({
  value,
  onChangeText,
  length,
  invalid,
  editable = true,
  shakeKey = 0,
}: CodeInputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeKey === 0) return;
    const step = (toValue: number) =>
      Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true });
    Animated.sequence([step(10), step(-10), step(6), step(-6), step(0)]).start();
  }, [shakeKey, shake]);

  return (
    <Animated.View style={[styles.row, { transform: [{ translateX: shake }] }]}>
      {Array.from({ length }, (_, index) => {
        const active = editable && focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={[
              styles.box,
              {
                backgroundColor: theme.surface,
                borderColor: invalid ? theme.error : active ? theme.borderFocus : theme.borderInput,
                borderWidth: invalid || active ? 2 : 1.5,
              },
            ]}>
            {value[index] ? (
              <ThemedText style={styles.digit}>{value[index]}</ThemedText>
            ) : (
              active && <View style={[styles.caret, { backgroundColor: theme.borderFocus }]} />
            )}
          </View>
        );
      })}
      <TextInput
        accessibilityLabel={`${length}-digit code`}
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, length))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={editable}
        autoFocus
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={length}
        caretHidden
        selectionColor="transparent"
        style={styles.hiddenInput}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    flex: 1,
    height: ControlHeight.input,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
  },
  caret: {
    width: 2,
    height: 26,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    color: 'transparent',
    backgroundColor: 'transparent',
    fontSize: 1,
  },
});
