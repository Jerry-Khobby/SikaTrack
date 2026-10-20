import { Pressable, Text, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type InsightSeverity = 'info' | 'tip' | 'warning';

export type InsightCardProps = {
  severity: InsightSeverity;
  title: string;
  body: string;
  onPress?: () => void;
};

const LOOK: Record<InsightSeverity, { label: string; icon: IconName; box: string; accent: string }> = {
  warning: { label: 'Heads-up', icon: 'alert', box: 'bg-tint-amber', accent: 'text-icon-amber' },
  info: { label: 'Insight', icon: 'info', box: 'bg-tint-blue', accent: 'text-link' },
  tip: { label: 'Tip', icon: 'lightbulb', box: 'bg-tint-success', accent: 'text-icon-success' },
};

/** A short card from `GET /v1/insights`, coloured by severity: info blue, tip green, warning amber. */
export function InsightCard({ severity, title, body, onPress }: InsightCardProps) {
  const theme = useTheme();
  const look = LOOK[severity];
  const iconColor = { warning: theme.iconAmber, info: theme.link, tip: theme.iconSuccess }[severity];

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${look.label}: ${title}. ${body}`}
      disabled={!onPress}
      onPress={onPress}
      className={`w-[262px] rounded-lg px-4 py-[14px] active:opacity-[0.85] ${look.box}`}>
      <View className="flex-row items-center gap-2">
        <Icon name={look.icon} color={iconColor} size={16} />
        <Text className={`font-sans-extrabold text-[12px] ${look.accent}`}>{look.label}</Text>
      </View>
      <ThemedText type="none" className="mt-2 font-sans-extrabold text-[15px] leading-[20px]">
        {title}
      </ThemedText>
      <ThemedText
        type="none"
        themeColor="textBody"
        className="mt-1 font-sans text-[13px] leading-[19px]"
        numberOfLines={2}>
        {body}
      </ThemedText>
    </Pressable>
  );
}
