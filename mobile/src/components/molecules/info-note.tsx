import { StyleSheet, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { Radius } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type InfoNoteProps = {
  icon: IconName;
  text: string;
  /** `info` for a tip, `warning` for something that blocks the next step. */
  tone?: 'info' | 'warning';
};

/** A tinted strip with a short message. */
export function InfoNote({ icon, text, tone = 'info' }: InfoNoteProps) {
  const theme = useTheme();
  const warning = tone === 'warning';

  return (
    <View
      accessibilityLiveRegion={warning ? 'polite' : 'none'}
      style={[styles.note, { backgroundColor: warning ? theme.tintOrange : theme.tintBlue }]}>
      <Icon name={icon} color={warning ? theme.iconOrange : theme.text} size={18} />
      <ThemedText type="caption" style={styles.text}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.sm,
  },
  text: {
    flex: 1,
  },
});
