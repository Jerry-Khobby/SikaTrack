import { Pressable } from 'react-native';

import { Icon, ThemedText, type IconName } from '@/components/atoms';
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
      className={`flex-row items-center gap-2.5 active:opacity-80 ${
        warning ? 'rounded-2xl bg-tint-amber px-4 py-[14px]' : 'rounded-sm bg-tint-blue px-[14px] py-2.5'
      }`}>
      <Icon name={icon} color={warning ? theme.iconAmber : theme.link} size={18} />
      <ThemedText
        type="none"
        className={`flex-1 ${warning ? 'font-sans-bold text-[14px] leading-[19px]' : 'font-sans-semibold text-[13px] leading-[18px]'}`}>
        {text}
      </ThemedText>
      {onPress && <Icon name="chevron-right" color={theme.text} size={16} />}
    </Pressable>
  );
}
