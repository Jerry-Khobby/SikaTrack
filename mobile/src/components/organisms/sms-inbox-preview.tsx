import { Fragment } from 'react';
import { View } from 'react-native';

import { Icon, ProviderBadge, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type SmsInboxPreviewProps = {
  /** The MoMo senders SikaTrack reads, each shown highlighted. */
  senders: { name: string; providerCode: string }[];
};

/** A soft lift under the card (native shadow props, which have no Tailwind class). */
const CARD_SHADOW = {
  elevation: 4,
  shadowColor: '#1B2631',
  shadowOpacity: 0.08,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 8 },
};

/**
 * A sketch of a phone inbox: the MoMo senders stand out and every other
 * message is faded and locked. Decorative, so screen readers skip it.
 */
export function SmsInboxPreview({ senders }: SmsInboxPreviewProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="w-[250px] gap-2 self-center rounded-[22px] bg-surface p-[14px]"
      style={CARD_SHADOW}>
      {senders.map((sender) => (
        <Fragment key={sender.name}>
          <View className="flex-row items-center gap-2.5 rounded-sm border-[1.5px] border-line-gold bg-tint-gold p-2">
            <ProviderBadge code={sender.providerCode} name={sender.name} size={30} />
            <View className="min-w-0 flex-1 gap-1.5">
              <ThemedText type="none" className="font-sans-bold text-[12px] leading-[18px]" numberOfLines={1}>
                {sender.name}
              </ThemedText>
              <View className="h-[7px] w-[85%] rounded bg-track" />
            </View>
          </View>
          <View className="flex-row items-center gap-2.5 p-2 opacity-[0.35]">
            <View className="h-[30px] w-[30px] rounded-[15px] bg-track" />
            <View className="min-w-0 flex-1 gap-1.5">
              <View className="h-[7px] w-16 rounded bg-toggle-off" />
              <View className="h-[7px] w-[85%] rounded bg-track" />
            </View>
            <Icon name="lock" color={theme.text} size={14} />
          </View>
        </Fragment>
      ))}
    </View>
  );
}
