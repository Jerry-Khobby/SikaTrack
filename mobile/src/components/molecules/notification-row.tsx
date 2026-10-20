import { Pressable, View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
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

const TONE_CLASSES: Record<Tone, string> = {
  blue: 'bg-tint-blue',
  red: 'bg-tint-red',
  amber: 'bg-tint-amber',
  green: 'bg-tint-success',
};

export function NotificationRow({ kind, title, body, time, unread, onPress, divider }: NotificationRowProps) {
  const theme = useTheme();
  const look = KINDS[kind] ?? { icon: 'bell', tone: 'blue' };
  const iconColor = { blue: theme.link, red: theme.iconRed, amber: theme.iconAmber, green: theme.iconSuccess }[look.tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${title}. ${body}. ${time}`}
      onPress={onPress}
      className={`flex-row gap-3 px-4 py-[14px] active:opacity-70 ${unread ? 'bg-unread-row' : ''} ${divider ? 'border-b border-divider' : ''}`}>
      <View className={`h-10 w-10 items-center justify-center rounded-[20px] ${TONE_CLASSES[look.tone]}`}>
        <Icon name={look.icon} color={iconColor} size={20} />
      </View>
      <View className="min-w-0 flex-1">
        <ThemedText
          type="none"
          className={`text-[14px] leading-[19px] ${unread ? 'font-sans-extrabold' : 'font-sans-semibold'}`}>
          {title}
        </ThemedText>
        <ThemedText type="none" themeColor="textBody" className="mt-0.5 font-sans text-[13px] leading-[19px]">
          {body}
        </ThemedText>
        <ThemedText type="fine" themeColor="textSecondary" className="mt-1">
          {time}
        </ThemedText>
      </View>
      {unread && <View className="mt-1.5 h-[9px] w-[9px] rounded-[5px] bg-unread-dot" />}
    </Pressable>
  );
}
