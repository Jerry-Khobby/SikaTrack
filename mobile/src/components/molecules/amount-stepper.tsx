import { Pressable, Text, View } from 'react-native';

import { Icon } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type AmountStepperProps = {
  currency: string;
  /** E.g. `5.00`. */
  value: string;
  /** What one tap changes, e.g. `GHS 1`. */
  stepLabel: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
};

/** A money amount between − and + buttons, e.g. S32's low-balance amount. */
export function AmountStepper({ currency, value, stepLabel, onDecrease, onIncrease, canDecrease, canIncrease }: AmountStepperProps) {
  const theme = useTheme();
  const button = (icon: 'minus' | 'plus', label: string, onPress: () => void, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={onPress}
      className={`h-[52px] w-[52px] items-center justify-center rounded-2xl border-[1.5px] border-line-input bg-surface ${
        enabled ? 'active:bg-chip' : 'opacity-40'
      }`}>
      <Icon name={icon} color={theme.text} size={22} />
    </Pressable>
  );

  return (
    <View className="flex-row items-center gap-2.5 rounded-[20px] bg-surface p-[14px]">
      {button('minus', `Decrease by ${stepLabel}`, onDecrease, canDecrease)}
      <View
        accessible
        accessibilityLabel={`${currency} ${value}`}
        accessibilityLiveRegion="polite"
        className="flex-1 flex-row items-baseline justify-center gap-1">
        <Text className="font-sans-bold text-[16px] text-content-secondary">{currency}</Text>
        <Text className="font-sans-extrabold text-[36px] text-content" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
      </View>
      {button('plus', `Increase by ${stepLabel}`, onIncrease, canIncrease)}
    </View>
  );
}
