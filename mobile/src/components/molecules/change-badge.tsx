import { Text, View } from 'react-native';

export type ChangeBadgeProps = {
  /** E.g. `30.5% vs September`. */
  text: string;
  down: boolean;
  /** Whether this direction is good news; for spending, down is good. */
  good: boolean;
  /** On a white card instead of brand ink. */
  onSurface?: boolean;
};

/** `▼ 30.5% vs September`, green when good and red when not; on brand ink unless `onSurface`. */
export function ChangeBadge({ text, down, good, onSurface }: ChangeBadgeProps) {
  const box = onSurface ? (good ? 'bg-tint-success' : 'bg-tint-red') : good ? 'bg-brand-good-on-ink-tint' : 'bg-brand-bad-on-ink-tint';
  const ink = onSurface ? (good ? 'text-icon-success' : 'text-icon-red') : good ? 'text-brand-good-on-ink' : 'text-brand-bad-on-ink';
  return (
    <View
      accessible
      accessibilityLabel={`${down ? 'Down' : 'Up'} ${text}`}
      className={`mt-1.5 self-start rounded-[10px] px-[9px] py-[3px] ${box}`}>
      <Text className={`font-sans-bold text-[13px] leading-[18px] ${ink}`}>
        {down ? '▼' : '▲'} {text}
      </Text>
    </View>
  );
}
