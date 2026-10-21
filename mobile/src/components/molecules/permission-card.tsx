import { Pressable, Text, View } from 'react-native';

import { Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type PermissionCardProps = {
  allowed: boolean;
  /** E.g. `Android notifications are on`. */
  title: string;
  /** E.g. `SikaTrack can send you alerts.` */
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/** Whether Android allows something for the app: green when on, amber when off, with a way to settings. */
export function PermissionCard({ allowed, title, message, actionLabel, onAction }: PermissionCardProps) {
  const theme = useTheme();

  return (
    <View className={`flex-row items-center gap-3 rounded-2xl px-4 py-[14px] ${allowed ? 'bg-tint-success' : 'bg-tint-amber'}`}>
      <Icon name={allowed ? 'check' : 'alert'} color={allowed ? theme.iconSuccess : theme.iconAmber} size={20} />
      <View className="min-w-0 flex-1">
        <ThemedText type="none" className="font-sans-extrabold text-[14px] leading-[19px]">
          {title}
        </ThemedText>
        <ThemedText type="fine" themeColor="textBody">
          {message}
        </ThemedText>
      </View>
      <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8} className="py-2">
        <Text className="font-sans-bold text-[12px] text-link">{actionLabel}</Text>
      </Pressable>
    </View>
  );
}
