import { View } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
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
      className={`flex-row items-center gap-2.5 rounded-sm px-[14px] py-3 ${warning ? 'bg-tint-orange' : 'bg-tint-blue'}`}>
      <Icon name={icon} color={warning ? theme.iconOrange : theme.text} size={18} />
      <ThemedText type="caption" className="flex-1">
        {text}
      </ThemedText>
    </View>
  );
}
