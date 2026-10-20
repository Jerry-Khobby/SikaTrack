import { Text, View } from 'react-native';

export type RecurringHeroProps = {
  /** E.g. `GHS 235.00`. */
  monthly: string;
  active: number;
};

/** The ink card on top of S28: what the active recurring payments cost a month together. */
export function RecurringHero({ monthly, active }: RecurringHeroProps) {
  return (
    <View className="rounded-[22px] bg-brand-ink p-5">
      <Text className="font-sans-semibold text-[13px] leading-[18px] text-brand-on-ink-muted">Recurring payments</Text>
      <Text
        className="mt-1 font-sans-extrabold text-[30px] leading-[38px] text-brand-on-ink"
        style={{ fontVariant: ['tabular-nums'] }}
        adjustsFontSizeToFit
        numberOfLines={1}>
        {monthly}
        <Text className="font-sans-semibold text-[15px] text-brand-on-ink-muted"> a month</Text>
      </Text>
      <Text className="mt-1.5 font-sans text-[12px] leading-[17px] text-brand-on-ink-muted">
        {active} active · worked out from your MoMo SMS
      </Text>
    </View>
  );
}
