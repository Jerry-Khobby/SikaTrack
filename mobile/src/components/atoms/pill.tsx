import { Text, View } from 'react-native';

export type PillTone = 'blue' | 'green' | 'red' | 'amber' | 'neutral';

export type PillProps = {
  label: string;
  tone?: PillTone;
};

const TONES: Record<PillTone, { box: string; text: string }> = {
  blue: { box: 'bg-tint-blue', text: 'text-link' },
  green: { box: 'bg-tint-success', text: 'text-icon-success' },
  red: { box: 'bg-tint-red', text: 'text-icon-red' },
  amber: { box: 'bg-tint-amber', text: 'text-icon-amber' },
  neutral: { box: 'bg-avatar', text: 'text-content-body' },
};

/** A small status label: "Processing", "Confirmed", "Low", "Queued". */
export function Pill({ label, tone = 'neutral' }: PillProps) {
  const colors = TONES[tone];

  return (
    <View className={`self-center rounded-lg px-[7px] py-px ${colors.box}`}>
      <Text className={`font-sans-extrabold text-[10px] leading-[15px] ${colors.text}`}>{label}</Text>
    </View>
  );
}
