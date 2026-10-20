import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type PillTone = 'blue' | 'green' | 'red' | 'amber' | 'neutral';

export type PillProps = {
  label: string;
  tone?: PillTone;
};

/** A small status label: "Processing", "Confirmed", "Low", "Queued". */
export function Pill({ label, tone = 'neutral' }: PillProps) {
  const theme = useTheme();
  const colors = {
    blue: { background: theme.tintBlue, text: theme.link },
    green: { background: theme.tintSuccess, text: theme.iconSuccess },
    red: { background: theme.tintRed, text: theme.iconRed },
    amber: { background: theme.tintAmber, text: theme.iconAmber },
    neutral: { background: theme.avatar, text: theme.textBody },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: colors.background }]}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    alignSelf: 'center',
  },
  label: {
    fontFamily: FontFamily.extraBold,
    fontSize: 10,
    lineHeight: 15,
  },
});
