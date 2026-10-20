import { Text, View } from 'react-native';

export type ChangeBadgeProps = {
  /** E.g. `30.5% vs September`. */
  text: string;
  down: boolean;
  /** Whether this direction is good news; for spending, down is good. */
  good: boolean;
};

/** `▼ 30.5% vs September` on brand ink, green when good and red when not. */
export function ChangeBadge({ text, down, good }: ChangeBadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={`${down ? 'Down' : 'Up'} ${text}`}
      className={`mt-1.5 self-start rounded-[10px] px-[9px] py-[3px] ${good ? 'bg-brand-good-on-ink-tint' : 'bg-brand-bad-on-ink-tint'}`}>
      <Text className={`font-sans-bold text-[13px] leading-[18px] ${good ? 'text-brand-good-on-ink' : 'text-brand-bad-on-ink'}`}>
        {down ? '▼' : '▲'} {text}
      </Text>
    </View>
  );
}
