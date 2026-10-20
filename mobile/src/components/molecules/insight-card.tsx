import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';

export type InsightSeverity = 'info' | 'tip' | 'warning';

export type InsightCardProps = {
  severity: InsightSeverity;
  title: string;
  body: string;
  onPress?: () => void;
};

const LOOK: Record<InsightSeverity, { label: string; icon: IconName }> = {
  warning: { label: 'Heads-up', icon: 'alert' },
  info: { label: 'Insight', icon: 'info' },
  tip: { label: 'Tip', icon: 'lightbulb' },
};

/** A short card from `GET /v1/insights`, coloured by severity: info blue, tip green, warning amber. */
export function InsightCard({ severity, title, body, onPress }: InsightCardProps) {
  const theme = useTheme();
  const colors = {
    warning: { background: theme.tintAmber, accent: theme.iconAmber },
    info: { background: theme.tintBlue, accent: theme.link },
    tip: { background: theme.tintSuccess, accent: theme.iconSuccess },
  }[severity];
  const look = LOOK[severity];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${look.label}: ${title}. ${body}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.background }, pressed && { opacity: 0.85 }]}>
      <View style={styles.eyebrow}>
        <Icon name={look.icon} color={colors.accent} size={16} />
        <Text style={[styles.eyebrowText, { color: colors.accent }]}>{look.label}</Text>
      </View>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText type="caption" themeColor="textBody" style={styles.body} numberOfLines={2}>
        {body}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 262,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 12,
  },
  title: {
    marginTop: 8,
    fontFamily: FontFamily.extraBold,
    fontSize: 15,
    lineHeight: 20,
  },
  body: {
    marginTop: 4,
    lineHeight: 19,
  },
});
