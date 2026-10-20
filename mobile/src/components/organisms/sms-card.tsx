import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, Icon, ThemedText } from '@/components/atoms';
import { FontFamily } from '@/theme';
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
    <Card padding={0} radius={18} style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={styles.toggle}>
        <Icon name="message" color={theme.text} size={18} />
        <ThemedText style={styles.title}>View the SMS</ThemedText>
        {count > 1 && (
          <ThemedText type="fine" themeColor="textSecondary">
            {count} SMS
          </ThemedText>
        )}
        <View style={open && styles.flipped}>
          <Icon name="chevron-down" color={theme.text} size={16} />
        </View>
      </Pressable>
      {open && (
        <View style={styles.body}>
          <View style={[styles.bubble, { backgroundColor: theme.chip }]}>
            <ThemedText style={styles.sms} selectable>
              {text}
            </ThemedText>
          </View>
          <ThemedText type="fine" themeColor="textSecondary" style={styles.from}>
            {sender ? `From ${sender} · ${time}` : time}
          </ThemedText>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  toggle: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: 15,
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  bubble: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 4,
  },
  sms: {
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 19,
  },
  from: {
    marginTop: 6,
    fontSize: 11,
  },
});
