import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
import { FontFamily } from '@/theme';
import { useTheme } from '@/hooks/use-theme';
import type { NotificationKind } from '@/services/notifications';

export type NotificationRowProps = {
  kind: NotificationKind;
  title: string;
  body: string;
  /** E.g. `2 h ago`. */
  time: string;
  unread: boolean;
  onPress: () => void;
  divider?: boolean;
};

type Tone = 'blue' | 'red' | 'amber' | 'green';

/** Icon and colour per kind (docs/ui-spec.md S36). */
const KINDS: Record<NotificationKind, { icon: IconName; tone: Tone }> = {
  budget_warning: { icon: 'target', tone: 'amber' },
  budget_over: { icon: 'target', tone: 'red' },
  low_balance: { icon: 'wallet', tone: 'red' },
  new_recurring: { icon: 'repeat', tone: 'blue' },
  recurring_still_charging: { icon: 'repeat', tone: 'red' },
  weekly_digest: { icon: 'calendar', tone: 'blue' },
  data_ready: { icon: 'check', tone: 'green' },
  sync_problem: { icon: 'alert', tone: 'amber' },
};

export function NotificationRow({ kind, title, body, time, unread, onPress, divider }: NotificationRowProps) {
  const theme = useTheme();
  const look = KINDS[kind] ?? { icon: 'bell', tone: 'blue' };
  const colors = {
    blue: { background: theme.tintBlue, icon: theme.link },
    red: { background: theme.tintRed, icon: theme.iconRed },
    amber: { background: theme.tintAmber, icon: theme.iconAmber },
    green: { background: theme.tintSuccess, icon: theme.iconSuccess },
  }[look.tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}. ${body}. ${time}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        unread && { backgroundColor: theme.unreadRow },
        divider && { borderBottomWidth: 1, borderBottomColor: theme.divider },
        pressed && { opacity: 0.7 },
      ]}>
      <View style={[styles.icon, { backgroundColor: colors.background }]}>
        <Icon name={look.icon} color={colors.icon} size={20} />
      </View>
      <View style={styles.text}>
        <ThemedText style={[styles.title, { fontFamily: unread ? FontFamily.extraBold : FontFamily.semiBold }]}>
          {title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textBody" style={styles.body}>
          {body}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" style={styles.time}>
          {time}
        </ThemedText>
      </View>
      {unread && <View style={[styles.dot, { backgroundColor: theme.unreadDot }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    lineHeight: 19,
  },
  body: {
    marginTop: 2,
    lineHeight: 19,
  },
  time: {
    marginTop: 4,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 6,
  },
});
