import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card, Icon, ThemedText } from '@/components/atoms';
import { useTheme } from '@/hooks/use-theme';

export type SmsCardProps = {
  text: string;
  /** How many SMS made this transaction (2 when a duplicate was merged). */
  count: number;
  /** The SMS sender, e.g. `MobileMoney`. */
  sender: string | null;
  /** When it arrived, already formatted. */
  time: string;
};

/** "View the SMS": collapsed by default, opens to the original text. */
export function SmsCard({ text, count, sender, time }: SmsCardProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <Card padded={false} radius={18} className="overflow-hidden">
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        className="h-14 flex-row items-center gap-2.5 px-4">
        <Icon name="message" color={theme.text} size={18} />
        <ThemedText type="none" className="flex-1 font-sans-bold text-[15px]">
          View the SMS
        </ThemedText>
        {count > 1 && (
          <ThemedText type="fine" themeColor="textSecondary">
            {count} SMS
          </ThemedText>
        )}
        {/* Flips with `open`, so the rotation is inline: a toggled transform class remounts the view. */}
        <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
          <Icon name="chevron-down" color={theme.text} size={16} />
        </View>
      </Pressable>
      {open && (
        <View className="px-4 pb-4">
          <View className="rounded-[14px] rounded-bl bg-chip px-[14px] py-3">
            <ThemedText type="none" className="font-mono text-[12px] leading-[19px]" selectable>
              {text}
            </ThemedText>
          </View>
          <ThemedText type="none" themeColor="textSecondary" className="mt-1.5 font-sans text-[11px] leading-[18px]">
            {sender ? `From ${sender} · ${time}` : time}
          </ThemedText>
        </View>
      )}
    </Card>
  );
}
