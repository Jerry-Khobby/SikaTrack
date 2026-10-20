import { useEffect, useRef, useState } from 'react';
import { Animated, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/atoms';

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
  const [focused, setFocused] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeKey === 0) return;
    const step = (toValue: number) =>
      Animated.timing(shake, { toValue, duration: 50, useNativeDriver: true });
    Animated.sequence([step(10), step(-10), step(6), step(-6), step(0)]).start();
  }, [shakeKey, shake]);

  return (
    // The shake is an animated transform, so this row keeps an inline style.
    <Animated.View style={{ flexDirection: 'row', gap: 10, transform: [{ translateX: shake }] }}>
      {Array.from({ length }, (_, index) => {
        const active = editable && focused && index === Math.min(value.length, length - 1);
        const border = invalid
          ? 'border-2 border-error'
          : active
            ? 'border-2 border-line-focus'
            : 'border-[1.5px] border-line-input';
        return (
          <View key={index} className={`h-input flex-1 items-center justify-center rounded-sm bg-surface ${border}`}>
            {value[index] ? (
              <ThemedText type="none" className="font-sans-bold text-[26px] leading-[32px]">
                {value[index]}
              </ThemedText>
            ) : (
              active && <View className="h-[26px] w-0.5 bg-line-focus" />
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
        className="absolute inset-0 bg-transparent text-[1px] text-transparent"
      />
    </Animated.View>
  );
}
