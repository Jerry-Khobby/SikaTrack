import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type StatusStripProps = {
  icon: IconName;
  text: string;
  /** `info`: blue, e.g. the sync strip. `warning`: amber, e.g. SMS access is off. */
  tone?: 'info' | 'warning';
  onPress?: () => void;
};

/** A thin tinted line about the state of the data, tappable when there's somewhere to go. */
export function StatusStrip({ icon, text, tone = 'info', onPress }: StatusStripProps) {
  const theme = useTheme();
  const warning = tone === 'warning';

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={text}
      accessibilityLiveRegion="polite"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.strip,
        warning ? styles.warning : null,
        { backgroundColor: warning ? theme.tintAmber : theme.tintBlue },
        pressed && { opacity: 0.8 },
      ]}>
      <Icon name={icon} color={warning ? theme.iconAmber : theme.link} size={18} />
      <ThemedText style={[styles.text, warning && styles.warningText]}>{text}</ThemedText>
      {onPress && (
        <View>
          <Icon name="chevron-right" color={theme.text} size={16} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  warning: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  text: {
    flex: 1,
    fontFamily: FontFamily.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  warningText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 19,
  },
});
