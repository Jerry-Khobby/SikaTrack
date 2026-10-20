import { Text, View } from 'react-native';

export type StatTileProps = {
  label: string;
  value: string;
  /** The value's colour on brand ink: white, or orange for money in. */
  tone?: 'default' | 'moneyIn';
};

/** A small labelled figure inside the brand-ink hero card. */
export function StatTile({ label, value, tone = 'default' }: StatTileProps) {
  return (
    <View accessible accessibilityLabel={`${label}: ${value}`} className="min-w-0 flex-1 rounded-sm bg-brand-ink-tile p-2.5">
      <Text className="font-sans text-[11px] leading-[15px] text-brand-on-ink-muted">{label}</Text>
      <Text
        className={`mt-[3px] font-sans-extrabold text-[15px] leading-[20px] ${tone === 'moneyIn' ? 'text-brand-money-in-on-ink' : 'text-brand-on-ink'}`}
        style={{ fontVariant: ['tabular-nums'] }}
        numberOfLines={1}
        adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}
